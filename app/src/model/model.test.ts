import { describe, expect, it } from 'vitest';
import { astar } from './astar';
import { applyObservation, betaInterval95, betaMean, computeBeliefs, beliefKey } from './beta';
import { repetitionPenalty, scoreStops } from './priority';
import type { HypothesisDef, Stop } from './types';

const H: HypothesisDef[] = [
  { id: 'H1', descripcion: 'x', valor_cientifico: 1, por_tipo: { '0': { alpha: 2, beta: 1 }, '1': { alpha: 2, beta: 1 } } },
];

describe('Beta', () => {
  it('parte de 2/3 con α=2, β=1', () => {
    expect(betaMean({ alpha: 2, beta: 1 })).toBeCloseTo(2 / 3);
  });
  it('un "no" baja de 67 % a 50 %', () => {
    expect(betaMean(applyObservation({ alpha: 2, beta: 1 }, 'no'))).toBeCloseTo(0.5);
  });
  it('un "sí" sube a 75 %', () => {
    expect(betaMean(applyObservation({ alpha: 2, beta: 1 }, 'si'))).toBeCloseTo(0.75);
  });
  it('"inconcluso" no cambia α ni β (regla validada por Anfer)', () => {
    expect(applyObservation({ alpha: 2, beta: 1 }, 'inconcluso')).toEqual({ alpha: 2, beta: 1 });
  });
  it('reproduce la secuencia de referencia de MARSNOVA_validacion_combinada.m', () => {
    const seq = ['si', 'si', 'no', 'inconcluso', 'si', 'no', 'inconcluso'] as const;
    const esperado = [2 / 3, 3 / 4, 4 / 5, 4 / 6, 4 / 6, 5 / 7, 5 / 8, 5 / 8];
    let b = { alpha: 2, beta: 1 };
    const medias = [betaMean(b)];
    for (const r of seq) { b = applyObservation(b, r); medias.push(betaMean(b)); }
    medias.forEach((m, i) => expect(m).toBeCloseTo(esperado[i], 12));
    expect(b).toEqual({ alpha: 5, beta: 3 });
  });
  it('IC 95 % exacto coincide con betaincinv / scipy', () => {
    const casos: [number, number, number, number][] = [
      [2, 1, 0.15811388300841897, 0.9874208829065749],
      [5, 3, 0.2904208637373427, 0.9010117215574921],
      [10, 4, 0.461868460765959, 0.9090796054279033],
    ];
    for (const [a, b, lo, hi] of casos) {
      const [l, h] = betaInterval95({ alpha: a, beta: b });
      expect(l).toBeCloseTo(lo, 8);
      expect(h).toBeCloseTo(hi, 8);
    }
  });
  it('una observación actualiza todo el tipo, no los otros tipos', () => {
    const b = computeBeliefs(H, [{ hypothesisId: 'H1', terrainType: 0, result: 'no' }]);
    expect(betaMean(b[beliefKey('H1', 0)])).toBeCloseTo(0.5);
    expect(betaMean(b[beliefKey('H1', 1)])).toBeCloseTo(2 / 3);
  });
});

describe('A*', () => {
  // 5x5 con un muro en la columna 2 salvo la última fila
  const P = -1;
  const celdas = [
    1, 1, P, 1, 1,
    1, 1, P, 1, 1,
    1, 1, P, 1, 1,
    1, 1, P, 1, 1,
    1, 1, 1, 1, 1,
  ];
  const grid = { ancho: 5, alto: 5, celdas, prohibido: P };

  it('encuentra una ruta que evita las celdas prohibidas', () => {
    const r = astar(grid, { fila: 0, col: 0 }, { fila: 0, col: 4 });
    expect(r).not.toBeNull();
    for (const c of r!.path) expect(celdas[c.fila * 5 + c.col]).not.toBe(P);
    expect(r!.path[0]).toEqual({ fila: 0, col: 0 });
    expect(r!.path.at(-1)).toEqual({ fila: 0, col: 4 });
  });

  it('devuelve null si el destino está aislado', () => {
    const closed = celdas.slice();
    closed[4 * 5 + 2] = P;
    expect(astar({ ...grid, celdas: closed }, { fila: 0, col: 0 }, { fila: 0, col: 4 })).toBeNull();
  });
});

describe('Prioridad', () => {
  it('la penalización nunca llega a cero', () => {
    expect(repetitionPenalty(100, 0.5)).toBeGreaterThan(0);
  });

  it('prefiere un tipo de terreno no visitado', () => {
    const base: Stop = { id: 'BASE', nombre: 'Base', fila: 0, col: 0, tipo: 0, hipotesis: [], pregunta: '', que_observar: '', foto: null, es_base: true };
    const mk = (id: string, tipo: number): Stop => ({ ...base, id, tipo, es_base: false, hipotesis: ['H1'], fila: 1, col: 1 });
    const scores = scoreStops({
      stops: [base, mk('A', 0), mk('B', 1)],
      hypotheses: H,
      beliefs: computeBeliefs(H, []),
      visitsByType: { 0: 3 },
      currentStopId: 'BASE',
      base,
      resM: 5,
      routeCost: () => 10,
    });
    expect(scores[0].stop.id).toBe('B');
  });
});

import { findEvaWindow } from './evaWindow';

describe('Ventana de caminata', () => {
  const horas = Array.from({ length: 24 }, (_, h) => h);
  const temp = horas.map((h) => -80 + 3 * h);
  it('elige el bloque de luz más largo con viento bajo', () => {
    const viento = horas.map((h) => (h >= 9 && h < 12) || (h >= 13 && h < 17) ? 3 : 12);
    const w = findEvaWindow(horas, viento, temp, { vientoMax: 8, luz: [6, 18] })!;
    expect(w.inicio).toBe(13);
    expect(w.fin).toBe(17);
    expect(w.horas).toBe(4);
  });
  it('ignora las horas de noche aunque haya poco viento', () => {
    const viento = horas.map((h) => (h < 5 ? 1 : 20));
    expect(findEvaWindow(horas, viento, temp)).toBeNull();
  });
  it('usa las horas de luz reales si se pasan', () => {
    const viento = horas.map(() => 3);
    const luz = horas.map((h) => h >= 7 && h < 18);
    const w = findEvaWindow(horas, viento, temp, undefined, luz)!;
    expect([w.inicio, w.fin]).toEqual([7, 18]);
  });
});

describe('Paradas visitadas', () => {
  it('no vuelve a sugerir una parada ya visitada', () => {
    const base: Stop = { id: 'BASE', nombre: 'Base', fila: 0, col: 0, tipo: 0, hipotesis: [], pregunta: '', que_observar: '', foto: null, es_base: true };
    const mk = (id: string, tipo: number): Stop => ({ ...base, id, tipo, es_base: false, hipotesis: ['H1'], fila: 1, col: 1 });
    const scores = scoreStops({
      stops: [base, mk('A', 0), mk('B', 1)],
      hypotheses: H,
      beliefs: computeBeliefs(H, []),
      visitsByType: {},
      currentStopId: 'BASE',
      visitedIds: new Set(['B']),
      base,
      resM: 5,
      routeCost: () => 10,
    });
    expect(scores.map((s) => s.stop.id)).toEqual(['A']);
  });
});
