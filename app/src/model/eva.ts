// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
/**
 * Plan de la caminata según el astronauta (masa corporal + herramientas).
 *
 * Usa el modelo de recursos del Excel del equipo (modelo/recursos_eva/):
 * hay dos perfiles de referencia (masa total con traje de 130 y 145 kg) con su
 * velocidad y sus consumos medidos sobre una misión. Para otra masa total se
 * interpola linealmente entre ellos (y se extrapola con límites fuera del rango).
 * Supuesto: el consumo por minuto de misión depende solo de la masa total.
 * Todos los valores son ESTIMADOS: no son especificaciones de un traje real.
 */
import type { NivelAlerta } from '@/services/donki';

export type Consumo = { o2_g: number; agua_refrigeracion_l: number; agua_potable_l: number; bateria: number };

export type PerfilReferencia = {
  nombre: string;
  masa_total_kg: number;
  velocidad_kmh: number;
  tiempo_mision_min: number;
  consumo: Consumo;
};

export type RecursosEva = {
  gravedad_marte_ms2: number;
  masa_traje_kg: number;
  capacidad: { o2_g: number; o2_emergencia_min: number; agua_refrigeracion_l: number; agua_potable_l: number; bateria: number };
  perfiles_referencia: PerfilReferencia[];
  ruta: { tramos_m: number[]; paradas_min: Record<string, number>; distancia_max_base_m: number };
  limites: {
    eva_max_h: number;
    reserva_o2_minima: number;
    reserva_o2_precaucion: number;
    bateria_minima: number;
    velocidad_min_kmh: number;
    velocidad_max_kmh: number;
  };
  herramientas: { id: string; nombre: string; masa_kg: number }[];
};

export type PerfilAstronauta = {
  masaCorporalKg: number;
  herramientas: string[];
  cargaExtraKg: number;
};

export type Veredicto = 'apto' | 'precaucion' | 'no_apto';

export type PlanEva = {
  masaHerramientasKg: number;
  masaTotalKg: number;
  pesoMarteN: number;
  /** Peso en Marte expresado como masa que se sentiría en la Tierra (kgf). */
  pesoEquivalenteTierraKgf: number;
  velocidadKmh: number;
  distanciaM: number;
  tiempoMarchaMin: number;
  tiempoParadasMin: number;
  tiempoMisionMin: number;
  consumo: Consumo;
  restante: { o2: number; agua_refrigeracion: number; agua_potable_l: number; bateria: number };
  fueraDeReferencia: boolean;
  veredicto: Veredicto;
  motivos: string[];
};

const lerp = (x: number, x1: number, y1: number, x2: number, y2: number) =>
  x2 === x1 ? y1 : y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function masaHerramientas(r: RecursosEva, ids: string[]): number {
  return r.herramientas.filter((h) => ids.includes(h.id)).reduce((s, h) => s + h.masa_kg, 0);
}

export function planEva(r: RecursosEva, p: PerfilAstronauta, nivel: NivelAlerta = 'normal'): PlanEva {
  const [A, B] = [...r.perfiles_referencia].sort((a, b) => a.masa_total_kg - b.masa_total_kg);
  const mh = masaHerramientas(r, p.herramientas);
  const masaTotal = p.masaCorporalKg + r.masa_traje_kg + mh + p.cargaExtraKg;
  const pesoN = masaTotal * r.gravedad_marte_ms2;

  const velocidad = clamp(
    lerp(masaTotal, A.masa_total_kg, A.velocidad_kmh, B.masa_total_kg, B.velocidad_kmh),
    r.limites.velocidad_min_kmh,
    r.limites.velocidad_max_kmh,
  );
  // Tasa por minuto de misión de cada recurso, interpolada por masa total.
  const tasa = (k: keyof Consumo) =>
    Math.max(0, lerp(masaTotal, A.masa_total_kg, A.consumo[k] / A.tiempo_mision_min, B.masa_total_kg, B.consumo[k] / B.tiempo_mision_min));

  const distancia = r.ruta.tramos_m.reduce((s, d) => s + d, 0);
  const marcha = (distancia / 1000 / velocidad) * 60;
  const paradas = Object.values(r.ruta.paradas_min).reduce((s, m) => s + m, 0);
  const t = marcha + paradas;

  const consumo: Consumo = {
    o2_g: tasa('o2_g') * t,
    agua_refrigeracion_l: tasa('agua_refrigeracion_l') * t,
    agua_potable_l: tasa('agua_potable_l') * t,
    bateria: tasa('bateria') * t,
  };
  const c = r.capacidad;
  const restante = {
    o2: 1 - consumo.o2_g / c.o2_g,
    agua_refrigeracion: 1 - consumo.agua_refrigeracion_l / c.agua_refrigeracion_l,
    agua_potable_l: c.agua_potable_l - consumo.agua_potable_l,
    bateria: c.bateria - consumo.bateria,
  };

  const fuera = masaTotal < A.masa_total_kg - 15 || masaTotal > B.masa_total_kg + 15;
  const L = r.limites;
  const noApto: string[] = [];
  const precaucion: string[] = [];
  if (nivel === 'refugio') noApto.push('Alerta de clima espacial: evento solar llegando a Marte.');
  if (t / 60 > L.eva_max_h) noApto.push(`La misión dura más de ${L.eva_max_h} h (máximo de NASA para una caminata).`);
  if (restante.o2 < L.reserva_o2_minima) noApto.push(`Volvería con menos del ${Math.round(L.reserva_o2_minima * 100)} % de oxígeno.`);
  if (restante.bateria < L.bateria_minima) noApto.push(`Volvería con menos del ${Math.round(L.bateria_minima * 100)} % de batería.`);
  if (restante.agua_potable_l < 0) noApto.push('El agua potable no alcanza para toda la misión.');
  if (restante.agua_refrigeracion < 0) noApto.push('El agua de refrigeración no alcanza para toda la misión.');
  if (nivel === 'precaucion') precaucion.push('Eyección solar en camino a Marte: planifica una caminata corta.');
  if (restante.o2 >= L.reserva_o2_minima && restante.o2 < L.reserva_o2_precaucion)
    precaucion.push(`Reserva de oxígeno al volver por debajo del ${Math.round(L.reserva_o2_precaucion * 100)} %.`);
  if (fuera) precaucion.push('Masa total fuera del rango del modelo de referencia (130–145 kg ± 15 kg): estimación poco confiable.');
  const veredicto: Veredicto = noApto.length ? 'no_apto' : precaucion.length ? 'precaucion' : 'apto';

  return {
    masaHerramientasKg: mh,
    masaTotalKg: masaTotal,
    pesoMarteN: pesoN,
    pesoEquivalenteTierraKgf: pesoN / 9.81,
    velocidadKmh: velocidad,
    distanciaM: distancia,
    tiempoMarchaMin: marcha,
    tiempoParadasMin: paradas,
    tiempoMisionMin: t,
    consumo,
    restante,
    fueraDeReferencia: fuera,
    veredicto,
    motivos: [...noApto, ...precaucion],
  };
}
