// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
import { describe, expect, it } from 'vitest';
import { applyObservation, UPDATE_RULES } from './beta';
import paradas from '../data/real/paradas.json';
import probabilidades from '../data/real/probabilidades.json';

describe('integración del protocolo de ciencia', () => {
  it('"No aplica" no cambia la Beta, igual que "Inconcluso"', () => {
    const b = { alpha: 2, beta: 1 };
    expect(applyObservation(b, 'no_aplica', UPDATE_RULES)).toEqual(b);
    expect(applyObservation(b, 'inconcluso', UPDATE_RULES)).toEqual(b);
  });
  it('cada hipótesis tiene su pregunta Qn y criterios', () => {
    for (const h of probabilidades.hipotesis) {
      expect(h.pregunta_id).toMatch(/^Q[1-5]$/);
      expect(h.criterios?.si).toBeTruthy();
      expect(h.criterios?.no_aplica).toBeTruthy();
    }
  });
  it('la app conserva el prior Beta(2,1)', () => {
    for (const h of probabilidades.hipotesis) for (const p of Object.values(h.por_tipo)) expect(p).toEqual({ alpha: 2, beta: 1 });
  });
  it('estaciones E1–E5 presentes y sin paradas provisionales S1/S2', () => {
    const ids = paradas.paradas.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['E1', 'E2', 'E3', 'E4', 'E5']));
    expect(ids).not.toContain('S1');
    expect(ids).not.toContain('S2');
  });
});
