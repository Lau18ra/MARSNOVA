import { applyObservation, beliefKey, betaMean, UPDATE_RULES } from './beta';
import type { BetaParams, HypothesisDef, ObservationResult } from './types';

export type HistoryEntry<T> = {
  item: T;
  key: string;
  antes: number;
  despues: number;
};

/** Reproduce las observaciones en orden y devuelve el cambio que produjo cada una. */
export function buildHistory<T extends { hypothesis_id: string; terrain_type: number; result: ObservationResult }>(
  hypotheses: HypothesisDef[],
  observations: T[],
): HistoryEntry<T>[] {
  const state: Record<string, BetaParams> = {};
  for (const h of hypotheses)
    for (const [t, p] of Object.entries(h.por_tipo)) state[beliefKey(h.id, Number(t))] = { ...p };

  const out: HistoryEntry<T>[] = [];
  for (const o of observations) {
    const key = beliefKey(o.hypothesis_id, o.terrain_type);
    const before = state[key];
    if (!before) continue;
    const after = applyObservation(before, o.result, UPDATE_RULES);
    state[key] = after;
    out.push({ item: o, key, antes: betaMean(before), despues: betaMean(after) });
  }
  return out;
}
