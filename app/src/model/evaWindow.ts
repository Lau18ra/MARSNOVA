/**
 * Ventana recomendada para salir a caminar en un día promedio.
 * Criterio (ajustable por el equipo): horas de luz con viento por debajo de
 * un umbral; se elige el bloque continuo más largo.
 */
export type EvaCriteria = {
  /** Viento máximo aceptable (m/s). */
  vientoMax: number;
  /** Horas de luz aproximadas [inicio, fin) en hora solar local. */
  luz: [number, number];
};

export const DEFAULT_EVA: EvaCriteria = { vientoMax: 8, luz: [6, 18] };

export type EvaWindow = {
  inicio: number;
  /** Hora en que termina (exclusiva). */
  fin: number;
  horas: number;
  tMin: number;
  tMax: number;
  vientoMaxEnVentana: number;
};

/**
 * @param luz Opcional: true en las horas con luz solar (por ejemplo, flujo
 *            solar en superficie > 0). Si no se pasa, se usa c.luz.
 */
export function findEvaWindow(
  horas: number[],
  viento: number[],
  temp: number[],
  c: EvaCriteria = DEFAULT_EVA,
  luz?: boolean[],
): EvaWindow | null {
  let best: { a: number; b: number } | null = null;
  let start = -1;
  const isDay = (i: number) => (luz ? luz[i] : horas[i] >= c.luz[0] && horas[i] < c.luz[1]);
  const ok = (i: number) => isDay(i) && viento[i] <= c.vientoMax;
  for (let i = 0; i <= horas.length; i++) {
    if (i < horas.length && ok(i)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (!best || i - start > best.b - best.a) best = { a: start, b: i };
      start = -1;
    }
  }
  if (!best) return null;
  const idx = Array.from({ length: best.b - best.a }, (_, k) => best!.a + k);
  return {
    inicio: horas[best.a],
    fin: horas[best.b - 1] + 1,
    horas: idx.length,
    tMin: Math.min(...idx.map((i) => temp[i])),
    tMax: Math.max(...idx.map((i) => temp[i])),
    vientoMaxEnVentana: Math.max(...idx.map((i) => viento[i])),
  };
}
