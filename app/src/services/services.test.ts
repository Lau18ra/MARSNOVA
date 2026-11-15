// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
import { describe, expect, it } from 'vitest';
import { dosisCaminata, dosisConAlerta, P_REF_PA, D_REF_UGY_DIA, tasaDosis } from './radiacion';
import { nivelAlerta } from './donki';

describe('radiación', () => {
  it('a la presión de referencia da el fondo de RAD', () => {
    expect(tasaDosis(P_REF_PA)).toBeCloseTo(D_REF_UGY_DIA);
  });
  it('más presión = menos dosis (escudo atmosférico)', () => {
    expect(tasaDosis(939)).toBeLessThan(tasaDosis(676));
  });
  it('dosis de la caminata proporcional a las horas', () => {
    expect(dosisCaminata(P_REF_PA, 24)).toBeCloseTo(D_REF_UGY_DIA);
    expect(dosisCaminata(P_REF_PA, 6)).toBeCloseTo(D_REF_UGY_DIA / 4);
  });
  it('la alerta suma el evento real', () => {
    expect(dosisConAlerta(P_REF_PA, 4, 'normal').extra).toBe(0);
    expect(dosisConAlerta(P_REF_PA, 4, 'refugio').extra).toBe(1730);
  });
});

describe('nivel de alerta DONKI', () => {
  const ahora = new Date('2024-05-20T00:00:00Z');
  const imp = (h: number) => ({ llegada: new Date(ahora.getTime() + h * 3.6e6).toISOString(), rozamiento: false, cme: null, enlace: null });
  it('sin impactos: normal', () => expect(nivelAlerta([], ahora)).toBe('normal'));
  it('llega en 6 h: refugio', () => expect(nivelAlerta([imp(6)], ahora)).toBe('refugio'));
  it('llega en 48 h: precaución', () => expect(nivelAlerta([imp(48)], ahora)).toBe('precaucion'));
  it('llegó hace 12 h: refugio', () => expect(nivelAlerta([imp(-12)], ahora)).toBe('refugio'));
  it('llegó hace 2 días: normal', () => expect(nivelAlerta([imp(-48)], ahora)).toBe('normal'));
});
