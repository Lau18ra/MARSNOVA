import type { BetaParams, HypothesisDef, ObservationInput, ObservationResult } from './types';

/**
 * Regla de actualización de cada respuesta (validada por Anfer en
 * MARSNOVA_validacion_combinada.m): sí → α + 1, no → β + 1,
 * inconcluso → no cambia nada (no aporta evidencia).
 * no aplica → no cambia nada; se cuenta aparte (protocolo de ciencia del equipo).
 * La alternativa que sugirió la profe era +0,5 a cada lado.
 */
export const UPDATE_RULES: Record<ObservationResult, BetaParams> = {
  si: { alpha: 1, beta: 0 },
  no: { alpha: 0, beta: 1 },
  inconcluso: { alpha: 0, beta: 0 },
  no_aplica: { alpha: 0, beta: 0 },
};

export const beliefKey = (hypothesisId: string, terrainType: number) =>
  `${hypothesisId}|${terrainType}`;

export type Beliefs = Record<string, BetaParams>;

export function applyObservation(
  prior: BetaParams,
  result: ObservationResult,
  rules: Record<ObservationResult, BetaParams> = UPDATE_RULES,
): BetaParams {
  const r = rules[result];
  return { alpha: prior.alpha + r.alpha, beta: prior.beta + r.beta };
}

/**
 * Recalcula todas las creencias desde cero: valores iniciales + observaciones.
 * Al guardar solo las observaciones (no α y β sueltos), una observación
 * duplicada por la sincronización nunca se cuenta dos veces si se deduplica
 * por UUID antes de llamar a esta función.
 */
export function computeBeliefs(
  hypotheses: HypothesisDef[],
  observations: ObservationInput[],
  rules: Record<ObservationResult, BetaParams> = UPDATE_RULES,
): Beliefs {
  const beliefs: Beliefs = {};
  for (const h of hypotheses) {
    for (const [tipo, p] of Object.entries(h.por_tipo)) {
      beliefs[beliefKey(h.id, Number(tipo))] = { alpha: p.alpha, beta: p.beta };
    }
  }
  for (const o of observations) {
    const key = beliefKey(o.hypothesisId, o.terrainType);
    const current = beliefs[key];
    if (!current) continue; // hipótesis o tipo sin valor inicial: se ignora
    beliefs[key] = applyObservation(current, o.result, rules);
  }
  return beliefs;
}

export const betaMean = ({ alpha, beta }: BetaParams) => alpha / (alpha + beta);

export const betaVariance = ({ alpha, beta }: BetaParams) => {
  const s = alpha + beta;
  return (alpha * beta) / (s * s * (s + 1));
};

/** Desviación estándar: la usamos como medida de incertidumbre en la interfaz. */
export const betaStd = (p: BetaParams) => Math.sqrt(betaVariance(p));

// ---- Función beta incompleta regularizada I_x(a, b) y su inversa ----
function lnGamma(z: number): number {
  // Aproximación de Lanczos (g = 7, n = 9)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a: number, b: number, x: number): number {
  // Fracción continua de Lentz (Numerical Recipes)
  const EPS = 1e-14, FPMIN = 1e-300;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** I_x(a, b): probabilidad acumulada de la Beta(a, b) en x. */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Cuantil de la Beta(a, b) por bisección (equivale a betaincinv de MATLAB). */
export function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Intervalo creíble central al 95 % (exacto, igual que en la validación de Anfer). */
export function betaInterval95(p: BetaParams): [number, number] {
  return [betaQuantile(0.025, p.alpha, p.beta), betaQuantile(0.975, p.alpha, p.beta)];
}

/** Incertidumbre normalizada a [0, 1]: 1 = máxima posible para una Beta (σ = 0,5). */
export const uncertainty01 = (p: BetaParams) => Math.min(1, betaStd(p) / 0.5);
