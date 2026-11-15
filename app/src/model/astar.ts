/**
 * A* sobre la grilla de costo (8 vecinos).
 * Archivo autocontenido (sin imports de valor) para poder usarlo también
 * desde scripts de Node.
 */

export type AStarGrid = {
  ancho: number;
  alto: number;
  celdas: number[];
  prohibido: number;
};

export type AStarCell = { fila: number; col: number };

export type AStarResult = {
  path: AStarCell[];
  /** Costo acumulado (unidades de la matriz de costo × celdas recorridas). */
  cost: number;
  /** Longitud geométrica en celdas (multiplicar por res_m para metros). */
  lengthCells: number;
};

class MinHeap {
  private items: { node: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(node: number, f: number) {
    const a = this.items;
    a.push({ node, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0].node;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const SQRT2 = Math.SQRT2;
const NEIGHBORS: [number, number, number][] = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, SQRT2], [-1, 1, SQRT2], [1, -1, SQRT2], [1, 1, SQRT2],
];

export function isBlocked(grid: AStarGrid, fila: number, col: number): boolean {
  if (fila < 0 || col < 0 || fila >= grid.alto || col >= grid.ancho) return true;
  const c = grid.celdas[fila * grid.ancho + col];
  return c === grid.prohibido || !(c > 0);
}

/**
 * Devuelve null si no hay ruta. El costo de un paso es el promedio del costo
 * de las dos celdas por la longitud del paso (1 o √2).
 * No permite "cortar esquinas" entre dos celdas prohibidas en diagonal.
 */
export function astar(grid: AStarGrid, start: AStarCell, goal: AStarCell): AStarResult | null {
  const { ancho, alto, celdas } = grid;
  if (isBlocked(grid, start.fila, start.col) || isBlocked(grid, goal.fila, goal.col)) return null;

  let minCost = Infinity;
  for (const c of celdas) if (c > 0 && c !== grid.prohibido && c < minCost) minCost = c;

  const n = ancho * alto;
  const g = new Float64Array(n).fill(Infinity);
  const len = new Float64Array(n);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const startIdx = start.fila * ancho + start.col;
  const goalIdx = goal.fila * ancho + goal.col;

  const h = (idx: number) => {
    const df = Math.abs(Math.floor(idx / ancho) - goal.fila);
    const dc = Math.abs((idx % ancho) - goal.col);
    // distancia octil × costo mínimo: admisible
    return (Math.max(df, dc) + (SQRT2 - 1) * Math.min(df, dc)) * minCost;
  };

  const open = new MinHeap();
  g[startIdx] = 0;
  open.push(startIdx, h(startIdx));

  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur]) continue;
    if (cur === goalIdx) break;
    closed[cur] = 1;
    const cf = Math.floor(cur / ancho);
    const cc = cur % ancho;
    for (const [df, dc, step] of NEIGHBORS) {
      const nf = cf + df;
      const nc = cc + dc;
      if (isBlocked(grid, nf, nc)) continue;
      if (df !== 0 && dc !== 0 && (isBlocked(grid, cf + df, cc) || isBlocked(grid, cf, cc + dc))) continue;
      const nb = nf * ancho + nc;
      if (closed[nb]) continue;
      const tentative = g[cur] + ((celdas[cur] + celdas[nb]) / 2) * step;
      if (tentative < g[nb]) {
        g[nb] = tentative;
        len[nb] = len[cur] + step;
        came[nb] = cur;
        open.push(nb, tentative + h(nb));
      }
    }
  }

  if (!Number.isFinite(g[goalIdx])) return null;
  const path: AStarCell[] = [];
  for (let i = goalIdx; i !== -1; i = came[i]) {
    path.push({ fila: Math.floor(i / ancho), col: i % ancho });
    if (i === startIdx) break;
  }
  path.reverse();
  return { path, cost: g[goalIdx], lengthCells: len[goalIdx] };
}
