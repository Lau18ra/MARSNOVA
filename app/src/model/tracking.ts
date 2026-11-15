/**
 * Navegación sobre la grilla: ¿el astronauta va por la ruta y en la dirección correcta?
 *
 * Todo está en coordenadas de celda (fila, col) con decimales. Fila 0 = norte,
 * así que "norte" es fila decreciente y el rumbo se mide desde el norte en
 * sentido horario (0° = N, 90° = E), igual que una brújula.
 */

export type Pos = { fila: number; col: number };

/** Más lejos que esto de la ruta = desviado (GPS de teléfono ≈ ±5 m, celda = 10 m). */
export const OFF_ROUTE_M = 20;
/** A menos de esto del destino = llegando. */
export const ARRIVAL_M = 15;
/** Diferencia de rumbo a partir de la cual se considera que va en sentido contrario. */
export const WRONG_WAY_DEG = 100;
/** El rumbo objetivo apunta a un punto de la ruta a esta distancia por delante. */
const LOOKAHEAD_M = 20;

export type PathProjection = {
  /** Distancia de la posición a la ruta, en celdas. */
  dist: number;
  /** Distancia recorrida a lo largo de la ruta hasta el punto más cercano, en celdas. */
  along: number;
  /** Largo total de la ruta, en celdas. */
  total: number;
  /** Punto de la ruta más cercano a la posición. */
  closest: Pos;
};

function segLengths(path: Pos[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < path.length; i++) {
    out.push(Math.hypot(path[i].fila - path[i - 1].fila, path[i].col - path[i - 1].col));
  }
  return out;
}

/** Largo de la ruta, en celdas. */
export function pathLength(path: Pos[]): number {
  return segLengths(path).reduce((a, b) => a + b, 0);
}

/** Proyecta una posición sobre la polilínea de la ruta. */
export function projectOnPath(p: Pos, path: Pos[]): PathProjection | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return { dist: Math.hypot(p.fila - path[0].fila, p.col - path[0].col), along: 0, total: 0, closest: path[0] };
  }
  const lens = segLengths(path);
  const total = lens.reduce((a, b) => a + b, 0);
  let best: PathProjection = { dist: Infinity, along: 0, total, closest: path[0] };
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = lens[i - 1];
    const df = b.fila - a.fila;
    const dc = b.col - a.col;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.fila - a.fila) * df + (p.col - a.col) * dc) / (len * len)));
    const q = { fila: a.fila + t * df, col: a.col + t * dc };
    const d = Math.hypot(p.fila - q.fila, p.col - q.col);
    if (d < best.dist) best = { dist: d, along: acc + t * len, total, closest: q };
    acc += len;
  }
  return best;
}

/** Punto de la ruta a una distancia `along` (en celdas) desde el inicio, y la dirección del tramo. */
export function pointAlong(path: Pos[], along: number): { pos: Pos; dir: Pos } {
  if (path.length === 1) return { pos: path[0], dir: { fila: -1, col: 0 } };
  const lens = segLengths(path);
  let rest = Math.max(0, along);
  for (let i = 1; i < path.length; i++) {
    const len = lens[i - 1];
    if (rest <= len || i === path.length - 1) {
      const a = path[i - 1];
      const b = path[i];
      const t = len === 0 ? 0 : Math.min(1, rest / len);
      const dir = len === 0 ? { fila: -1, col: 0 } : { fila: (b.fila - a.fila) / len, col: (b.col - a.col) / len };
      return { pos: { fila: a.fila + t * (b.fila - a.fila), col: a.col + t * (b.col - a.col) }, dir };
    }
    rest -= len;
  }
  return { pos: path[path.length - 1], dir: { fila: -1, col: 0 } };
}

/** Rumbo de `from` a `to`, en grados desde el norte en sentido horario (0–360). */
export function bearingDeg(from: Pos, to: Pos): number {
  const deg = (Math.atan2(to.col - from.col, -(to.fila - from.fila)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Diferencia con signo entre dos rumbos, en (-180, 180]. Positivo = hay que girar a la derecha. */
export function angleDiff(target: number, current: number): number {
  const d = (((target - current) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

export type NavStatus = 'en_ruta' | 'desviado' | 'sentido_contrario' | 'llegando';

export type NavInfo = {
  status: NavStatus;
  /** Distancia a la ruta, en metros. */
  offRouteM: number;
  /** Lo que falta por la ruta hasta el destino, en metros (incluye volver a la ruta). */
  remainingM: number;
  /** Fracción de la ruta recorrida (0–1). */
  progress: number;
  /** Rumbo hacia donde debería caminar (vuelve a la ruta si está desviado). */
  targetBearing: number;
  /** Cuánto girar respecto al rumbo actual (+ derecha, − izquierda); null sin rumbo. */
  turnDeg: number | null;
  /** Punto de la ruta más cercano (para dibujar la línea de regreso). */
  closest: Pos;
};

export function navigate(p: Pos, path: Pos[], headingDeg: number | null, resM: number): NavInfo | null {
  const proj = projectOnPath(p, path);
  if (!proj) return null;
  const offRouteM = proj.dist * resM;
  const end = path[path.length - 1];
  const toEndM = Math.hypot(p.fila - end.fila, p.col - end.col) * resM;
  const remainingM = Math.min(toEndM, (proj.total - proj.along) * resM + offRouteM);

  // Desviado: apuntar al punto más cercano de la ruta. En ruta: a un punto un poco más adelante.
  const ahead = pointAlong(path, proj.along + LOOKAHEAD_M / resM).pos;
  const target = offRouteM > OFF_ROUTE_M ? proj.closest : ahead;
  const targetBearing = toEndM < ARRIVAL_M ? bearingDeg(p, end) : bearingDeg(p, target);
  const turnDeg = headingDeg == null ? null : angleDiff(targetBearing, headingDeg);

  let status: NavStatus = 'en_ruta';
  if (toEndM < ARRIVAL_M) status = 'llegando';
  else if (offRouteM > OFF_ROUTE_M) status = 'desviado';
  else if (turnDeg != null && Math.abs(turnDeg) > WRONG_WAY_DEG) status = 'sentido_contrario';

  return {
    status,
    offRouteM,
    remainingM,
    progress: proj.total > 0 ? proj.along / proj.total : 1,
    targetBearing,
    turnDeg,
    closest: proj.closest,
  };
}

/** Anclaje Tierra → grilla: un punto GPS real se hace coincidir con una celda. */
export type GeoAnchor = { lat: number; lon: number; fila: number; col: number };

const EARTH_R = 6371008.8;
const RAD = Math.PI / 180;

/**
 * Convierte una lectura GPS a la grilla marciana. Cada metro caminado en la
 * Tierra es un metro sobre la grilla, con el norte terrestre = norte de Marte.
 */
export function gpsToGrid(lat: number, lon: number, a: GeoAnchor, resM: number): Pos {
  const northM = (lat - a.lat) * RAD * EARTH_R;
  const eastM = (lon - a.lon) * RAD * EARTH_R * Math.cos(a.lat * RAD);
  return { fila: a.fila - northM / resM, col: a.col + eastM / resM };
}

export function compassLabel(deg: number): string {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return names[Math.round(deg / 45) % 8];
}
