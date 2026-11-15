import { astar, type AStarResult } from './astar';
import type { CostGrid, Stop } from './types';

export type PrecomputedRoutes = {
  fuente: string;
  /** Clave "P1-P2"; la ruta inversa se obtiene invirtiendo el arreglo. */
  rutas: Record<
    string,
    {
      camino: [number, number][];
      costo: number;
      /** Celdas de la ruta que la matriz de costo marca como no transitables (pendiente > 20°). */
      alertas?: { fila: number; col: number; pendiente_grados: number }[];
    }
  >;
};

export type RouteAlert = { fila: number; col: number; pendiente_grados: number };
export type RouteResult = AStarResult & { origen: 'precalculada' | 'A* en vivo'; alertas: RouteAlert[] };

/**
 * Recorrido completo planeado: base → paradas con tramos precalculados (en el orden
 * de `paradas`) → base. Une los tramos en una sola polilínea; las paradas sin
 * ruta precalculada (p. ej. S1, S2) quedan fuera.
 */
export function fullRoute(
  paradas: Stop[],
  grid: CostGrid,
  pre: PrecomputedRoutes,
): { path: [number, number][]; alertas: RouteAlert[] } | null {
  const base = paradas.find((s) => s.es_base);
  if (!base) return null;
  const inRoutes = new Set(Object.keys(pre.rutas).flatMap((k) => k.split('-')));
  const order = [base, ...paradas.filter((s) => !s.es_base && inRoutes.has(s.id)), base];
  if (order.length < 3) return null;
  const path: [number, number][] = [];
  const alertas: RouteAlert[] = [];
  for (let i = 1; i < order.length; i++) {
    const leg = findRoute(order[i - 1], order[i], grid, pre);
    if (!leg) continue;
    const cells = leg.path.map((c) => [c.fila, c.col] as [number, number]);
    path.push(...(path.length ? cells.slice(1) : cells));
    alertas.push(...leg.alertas);
  }
  return path.length > 1 ? { path, alertas } : null;
}

/** Usa la ruta precalculada si existe; si no, calcula A* en vivo. */
export function findRoute(
  from: Stop,
  to: Stop,
  grid: CostGrid,
  pre: PrecomputedRoutes,
): RouteResult | null {
  const direct = pre.rutas[`${from.id}-${to.id}`];
  const reverse = pre.rutas[`${to.id}-${from.id}`];
  const hit = direct ?? reverse;
  if (hit) {
    const cells = hit.camino.map(([fila, col]) => ({ fila, col }));
    if (!direct) cells.reverse();
    let lengthCells = 0;
    for (let i = 1; i < cells.length; i++) {
      lengthCells += Math.hypot(cells[i].fila - cells[i - 1].fila, cells[i].col - cells[i - 1].col);
    }
    return { path: cells, cost: hit.costo, lengthCells, origen: 'precalculada', alertas: hit.alertas ?? [] };
  }
  const r = astar(grid, from, to);
  return r ? { ...r, origen: 'A* en vivo', alertas: [] } : null;
}
