// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
import { describe, expect, it } from 'vitest';
import recursosJson from '../data/real/recursos_eva.json';
import { planEva, type RecursosEva } from './eva';

const r = recursosJson as unknown as RecursosEva;
const sinCarga = { herramientas: [] as string[], cargaExtraKg: 0 };

describe('plan de la caminata (modelo de recursos del Excel)', () => {
  it('reproduce el perfil de referencia de 145 kg (80 kg + traje de 65 kg)', () => {
    const p = planEva(r, { masaCorporalKg: 80, ...sinCarga });
    expect(p.masaTotalKg).toBe(145);
    expect(p.velocidadKmh).toBeCloseTo(2.4);
    expect(p.pesoMarteN).toBeCloseTo(145 * 3.72);
  });
  it('reproduce el perfil de referencia de 130 kg', () => {
    expect(planEva(r, { masaCorporalKg: 65, ...sinCarga }).velocidadKmh).toBeCloseTo(2.5);
  });
  it('ruta real con base en P02: 7352 m y 18 min de paradas', () => {
    const p = planEva(r, { masaCorporalKg: 80, ...sinCarga });
    expect(p.distanciaM).toBe(7352);
    expect(p.tiempoParadasMin).toBe(18);
    // mismo resultado que la hoja Itinerario_Base_P02 del Excel: ~202 min y ~62 % de O2
    expect(p.tiempoMisionMin).toBeCloseTo(201.8, 0);
    expect(p.restante.o2).toBeCloseTo(0.618, 2);
  });
  it('más carga = más lento y más consumo', () => {
    const liviano = planEva(r, { masaCorporalKg: 70, ...sinCarga });
    const cargado = planEva(r, { masaCorporalKg: 70, herramientas: ['sacatestigos', 'espectrometro'], cargaExtraKg: 10 });
    expect(cargado.masaTotalKg).toBeCloseTo(liviano.masaTotalKg + 16.5);
    expect(cargado.velocidadKmh).toBeLessThan(liviano.velocidadKmh);
    expect(cargado.restante.o2).toBeLessThan(liviano.restante.o2);
  });
  it('la velocidad se limita al rango del modelo', () => {
    const p = planEva(r, { masaCorporalKg: 150, herramientas: [], cargaExtraKg: 60 });
    expect(p.velocidadKmh).toBeGreaterThanOrEqual(r.limites.velocidad_min_kmh);
    expect(p.fueraDeReferencia).toBe(true);
    expect(p.veredicto).not.toBe('apto');
  });
  it('una alerta de refugio impide salir', () => {
    expect(planEva(r, { masaCorporalKg: 80, ...sinCarga }, 'refugio').veredicto).toBe('no_apto');
  });
  it('perfil típico: apto', () => {
    expect(planEva(r, { masaCorporalKg: 75, herramientas: ['martillo', 'bolsas', 'camara'], cargaExtraKg: 0 }).veredicto).toBe('apto');
  });
});
