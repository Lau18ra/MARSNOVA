import { beliefKey, betaMean, uncertainty01, type Beliefs } from './beta';
import type { HypothesisDef, Stop } from './types';

export type PriorityParams = {
  /** Fuerza de la penalización por visitas repetidas al mismo tipo de terreno. */
  lambda: number;
  /** Costo de ruta que reduce la prioridad a la mitad. */
  costoReferencia: number;
  /** Distancia máxima permitida desde la base, en metros (2 km acordado). */
  maxDistanciaBaseM: number;
};

export const DEFAULT_PRIORITY_PARAMS: PriorityParams = {
  lambda: 0.5,
  costoReferencia: 200,
  // Criterio de NASA para caminatas sin rover en Artemis: hasta 2 km del módulo/base
  // (Artemis EVA Lunar Surface ConOps, 2020). Con la base en P02, toda la ruta queda a ≤ 1,65 km.
  maxDistanciaBaseM: 2000,
};

export type StopScore = {
  stop: Stop;
  score: number;
  /** Desglose para que el astronauta vea por qué se sugiere (trazabilidad). */
  detalle: {
    informacion: number;
    costoRuta: number;
    visitasTipo: number;
    penalizacion: number;
    distanciaBaseM: number;
    alcanzable: boolean;
    hipotesis: { id: string; probabilidad: number; incertidumbre: number }[];
  };
};

/** Penalización 1 / (1 + λ·n): nunca llega a 0, así que volver sigue siendo posible. */
export const repetitionPenalty = (visits: number, lambda: number) => 1 / (1 + lambda * visits);

export function scoreStops(args: {
  stops: Stop[];
  hypotheses: HypothesisDef[];
  beliefs: Beliefs;
  visitsByType: Record<number, number>;
  currentStopId: string | null;
  /** Paradas ya visitadas: no se vuelven a sugerir (repetir el mismo sitio contaría dos veces la evidencia). */
  visitedIds?: Set<string>;
  base: Stop;
  resM: number;
  /** Costo de ruta desde la posición actual hasta la parada (Infinity si no hay ruta). */
  routeCost: (stop: Stop) => number;
  params?: PriorityParams;
}): StopScore[] {
  const p = args.params ?? DEFAULT_PRIORITY_PARAMS;
  const hypById = new Map(args.hypotheses.map((h) => [h.id, h]));
  const out: StopScore[] = [];

  for (const stop of args.stops) {
    if (stop.es_base || stop.id === args.currentStopId || args.visitedIds?.has(stop.id)) continue;

    const hips = stop.hipotesis
      .map((id) => {
        const h = hypById.get(id);
        const b = args.beliefs[beliefKey(id, stop.tipo)];
        if (!h || !b) return null;
        return { id, valor: h.valor_cientifico, probabilidad: betaMean(b), incertidumbre: uncertainty01(b) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const informacion = hips.reduce((s, x) => s + x.valor * x.incertidumbre, 0);
    const costoRuta = args.routeCost(stop);
    const visitasTipo = args.visitsByType[stop.tipo] ?? 0;
    const penalizacion = repetitionPenalty(visitasTipo, p.lambda);
    const distanciaBaseM =
      Math.hypot(stop.fila - args.base.fila, stop.col - args.base.col) * args.resM;
    const alcanzable = Number.isFinite(costoRuta) && distanciaBaseM <= p.maxDistanciaBaseM;

    const score = alcanzable
      ? (informacion / (1 + costoRuta / p.costoReferencia)) * penalizacion
      : 0;

    out.push({
      stop,
      score,
      detalle: {
        informacion,
        costoRuta,
        visitasTipo,
        penalizacion,
        distanciaBaseM,
        alcanzable,
        hipotesis: hips.map(({ id, probabilidad, incertidumbre }) => ({ id, probabilidad, incertidumbre })),
      },
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
