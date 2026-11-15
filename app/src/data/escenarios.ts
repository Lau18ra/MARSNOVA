/**
 * Escenarios climáticos de Anfer (Mars Climate Database v6.2).
 * Archivo real: src/data/real/escenarios.json. Cada escenario trae un
 * resumen por "mes" marciano (30° de Ls).
 */
import escenariosJson from './real/escenarios.json';

export type ClimateMonth = {
  ls: [number, number];
  tsurf_min_c: number;
  tsurf_max_c: number;
  hora_tsurf_max: number;
  taire_min_c: number;
  taire_max_c: number;
  tau_media: number;
  tau_max: number;
  sol_max_wm2: number;
  horas_luz: number;
  ps_min_pa: number;
  ps_max_pa: number;
  viento_max_ms: number;
};

export type ClimateScenario = { id: string; descripcion: string; meses: ClimateMonth[] };

type Raw = {
  sitio: string;
  fuente: string;
  uso: { rango: string[]; alerta: string; anios: string[] };
  escenarios: Record<string, { descripcion: string; meses: ClimateMonth[] }>;
};

const raw = escenariosJson as unknown as Raw;

export const climate = {
  sitio: raw.sitio,
  fuente: raw.fuente,
  anios: raw.uso.anios,
  rango: raw.uso.rango as [string, string],
  alerta: raw.uso.alerta,
  escenarios: Object.fromEntries(
    Object.entries(raw.escenarios).map(([id, s]) => [id, { id, ...s }]),
  ) as Record<string, ClimateScenario>,
};

/** Los 12 intervalos de Ls (0–30, …, 330–360). */
export const LS_BINS: [number, number][] = Array.from({ length: 12 }, (_, i) => [i * 30, i * 30 + 30]);

export function monthFor(scenarioId: string, lsStart: number): ClimateMonth | undefined {
  return climate.escenarios[scenarioId]?.meses.find((m) => m.ls[0] === lsStart);
}

/** Estación aproximada en el hemisferio sur (Gale está a ~5° S). */
export function seasonSouth(lsStart: number): string {
  if (lsStart < 90) return 'otoño austral';
  if (lsStart < 180) return 'invierno austral';
  if (lsStart < 270) return 'primavera austral · temporada de polvo';
  return 'verano austral · temporada de polvo';
}

/** Problemas del archivo (se muestran en Misión). */
export function validateClimate(): string[] {
  const p: string[] = [];
  for (const id of [...climate.anios, ...climate.rango, climate.alerta])
    if (!climate.escenarios[id]) p.push(`escenarios.json: falta el escenario "${id}".`);
  for (const s of Object.values(climate.escenarios))
    for (const m of s.meses)
      if (m.tsurf_min_c > m.tsurf_max_c || m.ps_min_pa > m.ps_max_pa || m.tau_media > m.tau_max)
        p.push(`escenarios.json: ${s.id} Ls ${m.ls[0]}–${m.ls[1]} tiene un mínimo mayor que el máximo.`);
  return p;
}
