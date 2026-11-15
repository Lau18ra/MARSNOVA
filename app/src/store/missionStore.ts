import { create } from 'zustand';
import { dataset } from '@/data';
import { computeBeliefs, type Beliefs } from '@/model/beta';
import { scoreStops, type StopScore } from '@/model/priority';
import { findRoute, type RouteResult } from '@/model/routes';
import type { ObservationResult, Stop } from '@/model/types';
import { resetMission } from '@/db/database';
import {
  insertObservation,
  insertVisit,
  listObservations,
  listVisits,
  type ObservationRow,
  type VisitRow,
} from '@/db/repo';
import { countPending, serverStats, syncPending, type SyncReport } from '@/db/sync';

const stopsById = new Map(dataset.paradas.map((s) => [s.id, s]));
export const baseStop = dataset.paradas.find((s) => s.es_base) ?? dataset.paradas[0];

export const getStop = (id: string | null | undefined): Stop | undefined =>
  id ? stopsById.get(id) : undefined;

type ActiveRoute = RouteResult & { fromId: string; toId: string };

/** Fase de la misión: una misión completa es salir de la base y volver a ella. */
export type MissionPhase = 'en_base' | 'en_curso' | 'completa';

/**
 * Se sugiere volver cuando la mejor parada vale menos que esta fracción de lo
 * que valía la mejor al salir, o cuando ya se visitaron todas las paradas.
 */
export const RETURN_FRACTION = 0.2;

type MissionState = {
  ready: boolean;
  error: string | null;
  observations: ObservationRow[];
  visits: VisitRow[];
  beliefs: Beliefs;
  currentStopId: string;
  selectedHypothesisId: string;
  suggestions: StopScore[];
  route: ActiveRoute | null;
  phase: MissionPhase;
  shouldReturn: boolean;
  returnReason: string | null;

  networkOnline: boolean;
  simulatedOffline: boolean;
  pending: number;
  lastSync: (SyncReport & { at: string }) | null;
  server: { recibidos: number; unicos: number; local: number } | null;

  init: () => Promise<void>;
  recordObservation: (a: { stopId: string; hypothesisId: string; result: ObservationResult; note: string }) => Promise<void>;
  planRoute: (toStopId: string) => void;
  planReturn: () => void;
  markArrival: (stopId: string) => Promise<void>;
  selectHypothesis: (id: string) => void;
  setNetworkOnline: (online: boolean) => void;
  setSimulatedOffline: (off: boolean) => void;
  sync: () => Promise<void>;
  reset: () => Promise<void>;
};

export const isOnline = (s: Pick<MissionState, 'networkOnline' | 'simulatedOffline'>) =>
  s.networkOnline && !s.simulatedOffline;

function derive(observations: ObservationRow[], visits: VisitRow[]) {
  const beliefs = computeBeliefs(
    dataset.hipotesis,
    observations.map((o) => ({ hypothesisId: o.hypothesis_id, terrainType: o.terrain_type, result: o.result })),
  );
  const currentStopId = visits.length ? visits[visits.length - 1].stop_id : baseStop.id;
  const visitsByType: Record<number, number> = {};
  for (const v of visits) {
    if (getStop(v.stop_id)?.es_base) continue;
    visitsByType[v.terrain_type] = (visitsByType[v.terrain_type] ?? 0) + 1;
  }
  const current = getStop(currentStopId) ?? baseStop;
  const visitedIds = new Set(visits.map((v) => v.stop_id));
  const suggestions = scoreStops({
    stops: dataset.paradas,
    hypotheses: dataset.hipotesis,
    beliefs,
    visitsByType,
    currentStopId,
    visitedIds,
    base: baseStop,
    resM: dataset.costo.res_m,
    routeCost: (s) => findRoute(current, s, dataset.costo, dataset.rutas)?.cost ?? Infinity,
  });
  // Fase: completa si la última visita es la base y antes se visitó alguna parada.
  const lastBaseIdx = visits.map((v) => getStop(v.stop_id)?.es_base ?? false).lastIndexOf(true);
  const sciVisits = visits.filter((v) => !getStop(v.stop_id)?.es_base);
  const atBase = getStop(currentStopId)?.es_base ?? false;
  const phase: MissionPhase = sciVisits.length === 0 ? 'en_base' : atBase && lastBaseIdx === visits.length - 1 ? 'completa' : 'en_curso';

  // ¿Conviene volver a la base?
  const scienceStops = dataset.paradas.filter((s) => !s.es_base);
  const visitedSci = new Set(sciVisits.map((v) => v.stop_id));
  const best = suggestions[0]?.score ?? 0;
  let returnReason: string | null = null;
  if (phase === 'en_curso' && !atBase) {
    if (scienceStops.every((s) => visitedSci.has(s.id))) returnReason = 'Ya visitaste todas las paradas.';
    else if (best < RETURN_FRACTION * initialBestScore())
      returnReason = 'Las paradas que quedan aportan poco: la incertidumbre de las hipótesis ya bajó.';
  }
  return { beliefs, currentStopId, suggestions, phase, shouldReturn: returnReason !== null, returnReason };
}

let _initialBest: number | null = null;
/** Prioridad de la mejor parada al salir de la base, sin observaciones (referencia para volver). */
function initialBestScore(): number {
  if (_initialBest === null) {
    const beliefs = computeBeliefs(dataset.hipotesis, []);
    const s = scoreStops({
      stops: dataset.paradas,
      hypotheses: dataset.hipotesis,
      beliefs,
      visitsByType: {},
      currentStopId: baseStop.id,
      base: baseStop,
      resM: dataset.costo.res_m,
      routeCost: (st) => findRoute(baseStop, st, dataset.costo, dataset.rutas)?.cost ?? Infinity,
    });
    _initialBest = s[0]?.score ?? 0;
  }
  return _initialBest;
}

export const useMission = create<MissionState>((set, get) => ({
  ready: false,
  error: null,
  observations: [],
  visits: [],
  beliefs: computeBeliefs(dataset.hipotesis, []),
  currentStopId: baseStop.id,
  selectedHypothesisId: dataset.hipotesis[0]?.id ?? '',
  suggestions: [],
  route: null,
  phase: 'en_base',
  shouldReturn: false,
  returnReason: null,
  networkOnline: true,
  simulatedOffline: false,
  pending: 0,
  lastSync: null,
  server: null,

  init: async () => {
    try {
      const [observations, visits, pending, server] = await Promise.all([
        listObservations(),
        listVisits(),
        countPending(),
        serverStats(),
      ]);
      set({ observations, visits, pending, server, ...derive(observations, visits), ready: true, error: null });
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), ready: true });
    }
  },

  recordObservation: async ({ stopId, hypothesisId, result, note }) => {
    const stop = getStop(stopId);
    if (!stop) return;
    let visits = get().visits;
    // Registrar una observación implica haber llegado a la parada.
    if (get().currentStopId !== stopId) {
      const v = await insertVisit({ stopId, terrainType: stop.tipo });
      visits = [...visits, v];
    }
    const o = await insertObservation({
      stopId,
      hypothesisId,
      terrainType: stop.tipo,
      result,
      note,
      fila: stop.fila,
      col: stop.col,
    });
    const observations = [...get().observations, o];
    const route = get().route;
    set({
      observations,
      visits,
      selectedHypothesisId: hypothesisId,
      route: route && route.toId === stopId ? null : route,
      pending: await countPending(),
      ...derive(observations, visits),
    });
    if (isOnline(get())) void get().sync();
  },

  planRoute: (toStopId) => {
    const from = getStop(get().currentStopId) ?? baseStop;
    const to = getStop(toStopId);
    if (!to || to.id === from.id) return set({ route: null });
    const r = findRoute(from, to, dataset.costo, dataset.rutas);
    set({ route: r ? { ...r, fromId: from.id, toId: to.id } : null });
  },

  planReturn: () => get().planRoute(baseStop.id),

  markArrival: async (stopId) => {
    const stop = getStop(stopId);
    if (!stop || get().currentStopId === stopId) return;
    const v = await insertVisit({ stopId, terrainType: stop.tipo });
    const visits = [...get().visits, v];
    const route = get().route;
    set({
      visits,
      route: route && route.toId === stopId ? null : route,
      pending: await countPending(),
      ...derive(get().observations, visits),
    });
    if (isOnline(get())) void get().sync();
  },

  selectHypothesis: (id) => set({ selectedHypothesisId: id }),

  setNetworkOnline: (online) => {
    const wasOnline = isOnline(get());
    set({ networkOnline: online });
    if (!wasOnline && isOnline(get())) void get().sync();
  },

  setSimulatedOffline: (off) => {
    const wasOnline = isOnline(get());
    set({ simulatedOffline: off });
    if (!wasOnline && isOnline(get())) void get().sync();
  },

  sync: async () => {
    if (!isOnline(get())) return;
    const report = await syncPending();
    const [observations, visits, server] = await Promise.all([listObservations(), listVisits(), serverStats()]);
    set({ observations, visits, server, pending: report.pendientes, lastSync: { ...report, at: new Date().toISOString() } });
  },

  reset: async () => {
    await resetMission();
    set({ route: null, lastSync: null });
    await get().init();
  },
}));
