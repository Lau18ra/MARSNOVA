/**
 * Simulación de Monte Carlo: ruta FIJA contra ruta ADAPTATIVA.
 *
 * Usa exactamente el modelo de la app (src/model): Beta por hipótesis y tipo
 * de terreno, reglas Sí/No/Inconcluso, prioridad con valor científico,
 * incertidumbre, costo de ruta y penalización por tipo repetido.
 *
 * Diseño
 *  - Zona real (grilla de 10 m de Julián) y hipótesis H1–H5 de Juan.
 *  - 12 paradas candidatas, 4 por tipo de terreno, a menos de 2 km de la base:
 *    las de la app (P01, P03, S1, S2) más puntos extra elegidos en manchas
 *    continuas de cada tipo (semilla fija, reproducible).
 *  - "Verdad" oculta: en cada simulación se sortea un θ por hipótesis y tipo,
 *    uniforme entre 0,1 y 0,9 (así el resultado no depende de un θ elegido a mano).
 *  - Respuestas: 15 % inconcluso; si no, Sí con probabilidad θ.
 *  - Ruta fija: orden del vecino más cercano desde la base (un buen plan
 *    hecho antes de salir, que no aprende).
 *  - Ruta adaptativa: tras cada parada, la de mayor prioridad (lo que hace la app).
 *  - Métricas tras k paradas: incertidumbre media ponderada por valor
 *    científico, error |media − θ| ponderado y distancia caminada.
 *
 * Uso: npx tsx scripts/montecarlo.ts <carpeta src/data/real> <salida.json> [n_simulaciones]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { applyObservation, beliefKey, betaCdf, betaMean, uncertainty01, type Beliefs } from '../src/model/beta';
import { DEFAULT_PRIORITY_PARAMS, scoreStops } from '../src/model/priority';
import { astar } from '../src/model/astar';
import type { HypothesisDef, ObservationResult, Stop } from '../src/model/types';

const [dir, outPath, nArg] = process.argv.slice(2);
const N = Number(nArg ?? 5000);
const K = 6; // paradas máximas por misión
const P_INCONCLUSO = 0.15;
/** Distancia máxima de la misión (ida y vuelta a la base), en metros. Infinity = sin límite. */
const BUDGET_M = Number(process.env.BUDGET_M ?? Infinity);
/** Costo de ruta que reduce la prioridad a la mitad (en la app: 200). */
const COSTO_REF = Number(process.env.COSTO_REF ?? 200);
/** 'app' = prioridad actual (incertidumbre); 'decision' = riesgo de decidir mal si la hipótesis se cumple o no. */
const PRIORIDAD = (process.env.PRIORIDAD ?? 'app') as 'app' | 'decision';
/** Riesgo de decidir mal: probabilidad de que θ esté del otro lado de 0,5. */
const riesgo = (a: number, b: number) => { const c = betaCdf(0.5, a, b); return Math.min(c, 1 - c); };

const read = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
const tipos = read('tipos.json');
const costo = read('costo.json');
const hyps: HypothesisDef[] = read('probabilidades.json').hipotesis;
const appStops: Stop[] = read('paradas.json').paradas;
const base = appStops.find((s) => s.es_base)!;
const grid = { ancho: costo.ancho, alto: costo.alto, celdas: costo.celdas as number[], prohibido: costo.prohibido };
const W = tipos.ancho;

// ---- generador aleatorio con semilla (mulberry32) ----
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- paradas candidatas: 4 por tipo ----
const rand0 = rng(2026);
const candidates: Stop[] = appStops.filter((s) => !s.es_base);
const hypFor = (t: number) => hyps.filter((h) => String(t) in h.por_tipo).map((h) => h.id);
const farEnough = (f: number, c: number) =>
  [base, ...candidates].every((s) => Math.hypot(s.fila - f, s.col - c) * 10 >= 250);
for (const t of [0, 1, 2]) {
  let tries = 0;
  while (candidates.filter((s) => s.tipo === t).length < 4 && tries++ < 200000) {
    const f = Math.floor(rand0() * tipos.alto);
    const c = Math.floor(rand0() * W);
    if (tipos.celdas[f * W + c] !== t || costo.celdas[f * W + c] === costo.prohibido) continue;
    if (Math.hypot(f - base.fila, c - base.col) * 10 > 2000) continue;
    let same = 0;
    for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) if (tipos.celdas[(f + df) * W + c + dc] === t) same++;
    if (same < 8 || !farEnough(f, c)) continue;
    if (!astar(grid, base, { fila: f, col: c })) continue;
    const n = candidates.filter((s) => s.tipo === t).length + 1;
    candidates.push({
      id: `C${t}${n}`, nombre: `Candidata ${['cresta', 'hondonada', 'arena'][t]} ${n}`, fila: f, col: c, tipo: t,
      hipotesis: hypFor(t), pregunta: '', que_observar: '', foto: null,
    });
  }
}

// ---- costos y distancias entre todos los puntos (precalculados una vez) ----
const pts = [base, ...candidates];
const idx = new Map(pts.map((p, i) => [p.id, i]));
const COST: number[][] = pts.map(() => pts.map(() => 0));
const DIST: number[][] = pts.map(() => pts.map(() => 0));
for (let i = 0; i < pts.length; i++)
  for (let j = i + 1; j < pts.length; j++) {
    const r = astar(grid, pts[i], pts[j]);
    if (!r) throw new Error(`sin ruta ${pts[i].id}-${pts[j].id}`);
    COST[i][j] = COST[j][i] = r.cost;
    DIST[i][j] = DIST[j][i] = r.lengthCells * 10;
  }

// Entrada para replicar en MATLAB sin grilla ni A* (se escribe junto a la salida)
if (process.env.EXPORT_ENTRADA) {
  writeFileSync(process.env.EXPORT_ENTRADA, JSON.stringify({
    descripcion: 'Puntos de la simulación: índice 0 = base (P02). COST y DIST son matrices simétricas entre todos los puntos (A* sobre la grilla de 10 m).',
    puntos: pts.map((p, i) => ({ indice: i, id: p.id, tipo: p.tipo, es_base: !!p.es_base, hipotesis: p.hipotesis, fila: p.fila, col: p.col })),
    tipos_terreno: { 0: 'cresta', 1: 'hondonada', 2: 'arena' },
    hipotesis: hyps.map((h) => ({ id: h.id, valor_cientifico: h.valor_cientifico, tipos: Object.keys(h.por_tipo).map(Number), alpha0: 2, beta0: 1 })),
    COST: COST.map((r) => r.map((x) => Math.round(x * 100) / 100)),
    DIST_m: DIST.map((r) => r.map((x) => Math.round(x))),
    reglas: {
      prioridad: 'sum(valor_cientifico * incertidumbre) / (1 + COST/200) / (1 + 0.5 * visitas_al_tipo); paradas visitadas excluidas',
      incertidumbre: 'desviacion_estandar(Beta) / 0.5',
      actualizacion: 'si -> alpha+1; no -> beta+1; inconcluso -> sin cambio',
      respuestas: 'inconcluso con p = 0.15; si no, si con probabilidad theta',
      theta: 'uniforme(0.1, 0.9) por hipotesis y tipo, nuevo en cada simulacion',
      ruta_fija: 'vecino mas cercano desde la base por COST; salta las paradas que no caben en el presupuesto',
      presupuesto: 'distancia acumulada + volver a la base <= presupuesto (DIST_m)',
      metricas: 'acierto = media posterior > 0.5 coincide con theta > 0.5, ponderado por valor cientifico; incertidumbre media ponderada',
    },
  }, null, 1));
}

// ---- celdas de conocimiento (hipótesis × tipo) ----
const cells = hyps.flatMap((h) => Object.keys(h.por_tipo).map((t) => ({ h: h.id, t: Number(t), w: h.valor_cientifico })));
const wSum = cells.reduce((s, c) => s + c.w, 0);
const priors = (): Beliefs => {
  const b: Beliefs = {};
  for (const h of hyps) for (const [t, p] of Object.entries(h.por_tipo)) b[beliefKey(h.id, Number(t))] = { ...p };
  return b;
};
function metrics(b: Beliefs, theta: Record<string, number>) {
  let u = 0, e = 0, ac = 0, rk = 0;
  for (const c of cells) {
    const k = beliefKey(c.h, c.t);
    u += c.w * uncertainty01(b[k]);
    e += c.w * Math.abs(betaMean(b[k]) - theta[k]);
    ac += c.w * (betaMean(b[k]) > 0.5 === theta[k] > 0.5 ? 1 : 0);
    rk += c.w * riesgo(b[k].alpha, b[k].beta);
  }
  return { u: u / wSum, e: e / wSum, ac: ac / wSum, rk: rk / wSum };
}

// ---- orden fijo: vecino más cercano desde la base ----
const fixedOrder: Stop[] = [];
{
  let cur = 0;
  const left = new Set(candidates.map((s) => idx.get(s.id)!));
  while (left.size) {
    let best = -1;
    for (const j of left) if (best < 0 || COST[cur][j] < COST[cur][best]) best = j;
    left.delete(best);
    fixedOrder.push(pts[best]);
    cur = best;
  }
}

type Series = { u: number[]; e: number[]; d: number[]; ac: number[]; rk: number[] };
function simulate(strategy: 'fija' | 'adaptativa', theta: Record<string, number>, r: () => number): Series {
  let b = priors();
  const visits: Stop[] = [];
  let cur = base;
  let dist = 0;
  const s: Series = { u: [], e: [], d: [], ac: [], rk: [] };
  const m0 = metrics(b, theta);
  s.u.push(m0.u); s.e.push(m0.e); s.d.push(0); s.ac.push(m0.ac); s.rk.push(m0.rk);
  const fits = (st: Stop) => {
    const ci = idx.get(cur.id)!, j = idx.get(st.id)!;
    return dist + DIST[ci][j] + DIST[j][0] <= BUDGET_M;
  };
  let fixedPos = 0;
  for (let k = 0; k < K; k++) {
    let next: Stop | undefined;
    if (strategy === 'fija') {
      // sigue el plan; salta las paradas que ya no caben en el presupuesto (no aprende de lo observado)
      while (fixedPos < fixedOrder.length && !fits(fixedOrder[fixedPos])) fixedPos++;
      next = fixedOrder[fixedPos++];
    } else {
      const vbt: Record<number, number> = {};
      for (const v of visits) vbt[v.tipo] = (vbt[v.tipo] ?? 0) + 1;
      const ci = idx.get(cur.id)!;
      if (PRIORIDAD === 'decision') {
        const visited = new Set(visits.map((v) => v.id));
        let bestS: Stop | undefined, bestV = -1;
        for (const st of candidates) {
          if (visited.has(st.id) || !fits(st)) continue;
          let info = 0;
          for (const h of st.hipotesis) { const bb = b[beliefKey(h, st.tipo)]; const hd = hyps.find((x) => x.id === h)!; if (bb) info += hd.valor_cientifico * riesgo(bb.alpha, bb.beta); }
          const v = (info / (1 + COST[ci][idx.get(st.id)!] / COSTO_REF)) / (1 + 0.5 * (vbt[st.tipo] ?? 0));
          if (v > bestV) { bestV = v; bestS = st; }
        }
        next = bestS;
      } else {
      const sc = scoreStops({
        stops: pts, hypotheses: hyps, beliefs: b, visitsByType: vbt, currentStopId: cur.id,
        visitedIds: new Set(visits.map((v) => v.id)), base, resM: 10,
        routeCost: (st) => COST[ci][idx.get(st.id)!],
        params: { ...DEFAULT_PRIORITY_PARAMS, costoReferencia: COSTO_REF },
      });
      next = sc.find((x) => x.score > 0 && fits(x.stop))?.stop;
      }
    }
    if (!next) {
      // la misión terminó: se repite el último valor para promediar por número de paradas
      while (s.u.length <= K) for (const key of ['u', 'e', 'd', 'ac', 'rk'] as const) s[key].push(s[key][s[key].length - 1]);
      break;
    }
    dist += DIST[idx.get(cur.id)!][idx.get(next.id)!];
    cur = next;
    visits.push(next);
    for (const h of next.hipotesis) {
      const key = beliefKey(h, next.tipo);
      if (!(key in b)) continue;
      const x = r();
      const res: ObservationResult = x < P_INCONCLUSO ? 'inconcluso' : r() < theta[key] ? 'si' : 'no';
      b = { ...b, [key]: applyObservation(b[key], res) };
    }
    const m = metrics(b, theta);
    s.u.push(m.u); s.e.push(m.e); s.ac.push(m.ac); s.rk.push(m.rk); s.d.push(dist + DIST[idx.get(cur.id)!][0]); // incluye volver a la base
  }
  return s;
}

// ---- Monte Carlo ----
const acc = {
  fija: { u: Array(K + 1).fill(0), e: Array(K + 1).fill(0), d: Array(K + 1).fill(0), ac: Array(K + 1).fill(0), rk: Array(K + 1).fill(0) },
  adaptativa: { u: Array(K + 1).fill(0), e: Array(K + 1).fill(0), d: Array(K + 1).fill(0), ac: Array(K + 1).fill(0), rk: Array(K + 1).fill(0) },
};
const finals = { fija: [] as number[], adaptativa: [] as number[] };
let wins = 0;
const r = rng(42);
for (let n = 0; n < N; n++) {
  const theta: Record<string, number> = {};
  for (const c of cells) theta[beliefKey(c.h, c.t)] = 0.1 + 0.8 * r();
  const seed = Math.floor(r() * 2 ** 31);
  const runs = { fija: simulate('fija', theta, rng(seed)), adaptativa: simulate('adaptativa', theta, rng(seed)) };
  for (const st of ['fija', 'adaptativa'] as const) {
    for (let k = 0; k <= K; k++) {
      acc[st].u[k] += runs[st].u[k] / N;
      acc[st].e[k] += runs[st].e[k] / N;
      acc[st].d[k] += runs[st].d[k] / N;
      acc[st].ac[k] += runs[st].ac[k] / N;
      acc[st].rk[k] += runs[st].rk[k] / N;
    }
    finals[st].push(runs[st].u[K]);
  }
  if (runs.adaptativa.u[K] < runs.fija.u[K]) wins++;
}

const out = {
  n_simulaciones: N,
  presupuesto_m: Number.isFinite(BUDGET_M) ? BUDGET_M : null,
  costo_referencia: COSTO_REF,
  prioridad: PRIORIDAD,
  paradas_por_mision: K,
  prob_inconcluso: P_INCONCLUSO,
  theta: 'uniforme entre 0,1 y 0,9, sorteado en cada simulación para cada hipótesis y tipo de terreno',
  orden_fijo: fixedOrder.slice(0, K).map((s) => s.id),
  candidatas: candidates.map((s) => ({ id: s.id, tipo: s.tipo, fila: s.fila, col: s.col, hipotesis: s.hipotesis })),
  promedio: acc,
  adaptativa_mejor_en: wins / N,
};
writeFileSync(outPath, JSON.stringify(out, null, 1));
const f = (x: number) => x.toFixed(3);
console.log(`N = ${N}; presupuesto ${BUDGET_M} m; costoRef ${COSTO_REF}; orden fijo: ${out.orden_fijo.slice(0, K).join(' → ')}`);
for (let k = 0; k <= K; k++)
  console.log(`k=${k}  incert F ${f(acc.fija.u[k])} A ${f(acc.adaptativa.u[k])} | riesgo F ${f(acc.fija.rk[k])} A ${f(acc.adaptativa.rk[k])} | acierto F ${f(acc.fija.ac[k])} A ${f(acc.adaptativa.ac[k])} | dist F ${acc.fija.d[k].toFixed(0)} A ${acc.adaptativa.d[k].toFixed(0)} m`);
console.log(`adaptativa con menor incertidumbre final en ${(100 * wins / N).toFixed(1)} % de las simulaciones`);
