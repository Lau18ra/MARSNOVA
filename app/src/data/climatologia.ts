/**
 * Promedio climatológico hora a hora (interfaz web de la MCD v6.2).
 * Archivo real: src/data/real/climatologia_web.json (de clima/matlab/mcd_web.m).
 */
import climJson from './real/climatologia_web.json';

type Variable = { nombre: string; unidad: string; valores: number[][] };

type Raw = {
  sitio: string;
  fuente: string;
  escenario: string;
  punto: string;
  recuperado: string;
  horas: number[];
  ls: number[];
  variables: Record<string, Variable>;
};

const raw = climJson as unknown as Raw;

export const climatologia = {
  fuente: raw.fuente,
  escenario: raw.escenario,
  punto: raw.punto,
  recuperado: raw.recuperado,
  horas: raw.horas,
  ls: raw.ls,
  variables: raw.variables,
};

/**
 * Ciclo diario promedio de una variable dentro de un intervalo de Ls
 * [lsStart, lsStart + 30): promedia las filas de la MCD que caen ahí
 * (cada 15° de Ls, así que son dos filas).
 */
export function dailyCycle(variable: string, lsStart: number, lsWidth = 30): number[] | null {
  const v = raw.variables[variable];
  if (!v) return null;
  const rows = raw.ls
    .map((ls, i) => ({ ls, i }))
    .filter(({ ls }) => ls >= lsStart && ls < lsStart + lsWidth)
    .map(({ i }) => v.valores[i]);
  if (rows.length === 0) return null;
  return raw.horas.map((_, h) => rows.reduce((s, r) => s + r[h], 0) / rows.length);
}
