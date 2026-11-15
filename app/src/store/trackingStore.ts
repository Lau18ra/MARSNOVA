import { create } from 'zustand';
import { velocidadPerfilMps } from './evaProfile';
import * as Location from 'expo-location';
import { dataset } from '@/data';
import { bearingDeg, gpsToGrid, pathLength, pointAlong, type GeoAnchor, type Pos } from '@/model/tracking';

/**
 * Seguimiento de la posición del astronauta sobre la grilla.
 * - 'gps': GPS del teléfono trasladado a Marte. Al iniciar, el punto donde está el
 *   teléfono se hace coincidir con la parada actual; desde ahí, cada metro caminado
 *   en la Tierra es un metro sobre la grilla.
 * - 'sim': un astronauta simulado camina la ruta activa (con botones para desviarse).
 */
export type TrackingMode = 'off' | 'gps' | 'sim';

const RES = dataset.costo.res_m;
/** Velocidad de la simulación: la del perfil del astronauta (pestaña Preparación). */
const walkMps = () => velocidadPerfilMps();
const SIM_TICK_MS = 250;
const SIM_SPEEDS = [1, 5, 20];
const TRAIL_MAX = 400;
/** Distancia mínima entre dos lecturas para estimar el rumbo por el movimiento. */
const HEADING_FROM_MOVE_M = 3;

type SimState = { path: Pos[]; total: number; along: number; lateral: number; lateralTarget: number; dir: 1 | -1; speed: number };

type TrackingState = {
  mode: TrackingMode;
  pos: Pos | null;
  /** Rumbo en grados desde el norte (0 = N, 90 = E). */
  heading: number | null;
  headingSource: 'brújula' | 'movimiento' | null;
  accuracyM: number | null;
  trail: Pos[];
  anchor: GeoAnchor | null;
  lastFix: { lat: number; lon: number } | null;
  sim: SimState | null;
  error: string | null;

  startGps: (anchorCell: Pos) => Promise<void>;
  recalibrate: (anchorCell: Pos) => void;
  startSim: (path: Pos[]) => void;
  simDeviate: () => void;
  simCorrect: () => void;
  simTurnAround: () => void;
  simCycleSpeed: () => void;
  stop: () => void;
};

let posSub: Location.LocationSubscription | null = null;
let headSub: Location.LocationSubscription | null = null;
let simTimer: ReturnType<typeof setInterval> | null = null;
/** Último punto usado para estimar el rumbo por movimiento (GPS). */
let moveRef: Pos | null = null;

function clearAll() {
  posSub?.remove();
  headSub?.remove();
  posSub = headSub = null;
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
  moveRef = null;
}

function withTrail(trail: Pos[], p: Pos): Pos[] {
  const last = trail[trail.length - 1];
  if (last && Math.hypot(p.fila - last.fila, p.col - last.col) < 0.3) return trail;
  const next = [...trail, p];
  return next.length > TRAIL_MAX ? next.slice(next.length - TRAIL_MAX) : next;
}

function simPosition(s: SimState): Pos {
  const { pos, dir } = pointAlong(s.path, s.along);
  // Desplazamiento perpendicular al tramo (a la derecha del sentido de la ruta).
  return { fila: pos.fila + dir.col * s.lateral, col: pos.col - dir.fila * s.lateral };
}

export const useTracking = create<TrackingState>((set, get) => ({
  mode: 'off',
  pos: null,
  heading: null,
  headingSource: null,
  accuracyM: null,
  trail: [],
  anchor: null,
  lastFix: null,
  sim: null,
  error: null,

  startGps: async (anchorCell) => {
    clearAll();
    set({ mode: 'gps', pos: null, heading: null, headingSource: null, trail: [], anchor: null, lastFix: null, sim: null, error: null });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        set({ mode: 'off', error: 'Sin permiso de ubicación. Actívalo en los ajustes del teléfono.' });
        return;
      }
      if (get().mode !== 'gps') return; // se canceló mientras se pedía el permiso
      posSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
        (loc) => {
          const s = get();
          if (s.mode !== 'gps') return;
          const { latitude: lat, longitude: lon, accuracy } = loc.coords;
          const anchor = s.anchor ?? { lat, lon, fila: anchorCell.fila, col: anchorCell.col };
          const pos = gpsToGrid(lat, lon, anchor, RES);
          const patch: Partial<TrackingState> = { anchor, pos, lastFix: { lat, lon }, accuracyM: accuracy ?? null, trail: withTrail(s.trail, pos) };
          // Sin brújula (web, emulador): rumbo a partir del movimiento.
          if (!moveRef) moveRef = pos;
          else if (Math.hypot(pos.fila - moveRef.fila, pos.col - moveRef.col) * RES >= HEADING_FROM_MOVE_M) {
            if (s.headingSource !== 'brújula') Object.assign(patch, { heading: bearingDeg(moveRef, pos), headingSource: 'movimiento' });
            moveRef = pos;
          }
          set(patch);
        },
        (reason) => set({ error: `GPS: ${reason}` }),
      );
      try {
        headSub = await Location.watchHeadingAsync((h) => {
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (get().mode === 'gps' && Number.isFinite(deg) && h.accuracy > 0) set({ heading: deg, headingSource: 'brújula' });
        });
      } catch {
        // Sin brújula: se usa el rumbo del movimiento.
      }
      if (get().mode !== 'gps') clearAll();
    } catch (e) {
      clearAll();
      set({ mode: 'off', error: `No se pudo iniciar el GPS: ${String(e)}` });
    }
  },

  recalibrate: (anchorCell) => {
    const { lastFix } = get();
    if (!lastFix) return;
    const anchor = { ...lastFix, fila: anchorCell.fila, col: anchorCell.col };
    moveRef = null;
    set({ anchor, pos: { fila: anchorCell.fila, col: anchorCell.col }, trail: [] });
  },

  startSim: (path) => {
    clearAll();
    if (path.length < 2) return set({ mode: 'off' });
    const sim: SimState = { path, total: pathLength(path), along: 0, lateral: 0, lateralTarget: 0, dir: 1, speed: SIM_SPEEDS[1] };
    const pos = simPosition(sim);
    set({ mode: 'sim', sim, pos, heading: bearingDeg(path[0], path[1]), headingSource: 'movimiento', accuracyM: null, trail: [pos], anchor: null, lastFix: null, error: null });
    simTimer = setInterval(() => {
      const s = get();
      if (s.mode !== 'sim' || !s.sim || !s.pos) return;
      const cur = s.sim;
      const step = (walkMps() * cur.speed * (SIM_TICK_MS / 1000)) / RES; // celdas por tick
      const end = cur.total;
      const atEnd = (cur.dir === 1 && cur.along >= end) || (cur.dir === -1 && cur.along <= 0);
      const dLat = cur.lateralTarget - cur.lateral;
      if (atEnd && Math.abs(dLat) < 1e-6) return;
      const next: SimState = {
        ...cur,
        along: atEnd ? cur.along : Math.max(0, Math.min(end, cur.along + cur.dir * step)),
        lateral: Math.abs(dLat) <= step ? cur.lateralTarget : cur.lateral + Math.sign(dLat) * step,
      };
      const pos = simPosition(next);
      const moved = Math.hypot(pos.fila - s.pos.fila, pos.col - s.pos.col) > 1e-3;
      set({ sim: next, pos, heading: moved ? bearingDeg(s.pos, pos) : s.heading, trail: withTrail(s.trail, pos) });
    }, SIM_TICK_MS);
  },

  simDeviate: () => {
    const sim = get().sim;
    if (sim) set({ sim: { ...sim, lateralTarget: sim.lateralTarget + 40 / RES } });
  },
  simCorrect: () => {
    const sim = get().sim;
    if (sim) set({ sim: { ...sim, lateralTarget: 0, dir: 1 } });
  },
  simTurnAround: () => {
    const sim = get().sim;
    if (sim) set({ sim: { ...sim, dir: sim.dir === 1 ? -1 : 1 } });
  },
  simCycleSpeed: () => {
    const sim = get().sim;
    if (sim) set({ sim: { ...sim, speed: SIM_SPEEDS[(SIM_SPEEDS.indexOf(sim.speed) + 1) % SIM_SPEEDS.length] } });
  },

  stop: () => {
    clearAll();
    set({ mode: 'off', pos: null, heading: null, headingSource: null, accuracyM: null, trail: [], anchor: null, lastFix: null, sim: null, error: null });
  },
}));
