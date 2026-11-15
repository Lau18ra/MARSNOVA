/**
 * Punto único de entrada de los datos científicos.
 * - Zona real (Julián): grilla de 10 m sobre el AOI, paradas en V2 y rutas V2
 *   → src/data/real/, generados con scripts/build_real_data.py.
 *   Costo y tipos de terreno: ENTREGA SIG de Julián, aplicada con scripts/apply_sig.py
 *   (matriz de costo 1–6; tipos derivados del TPI de 30 m).
 * - Hipótesis H1–H5 de Juan David (src/data/real/probabilidades.json), con α = 2, β = 1.
 * Los datos sintéticos anteriores siguen en src/data/prueba/ por si se necesitan.
 */
import tiposJson from './real/tipos.json';
import costoJson from './real/costo.json';
import paradasJson from './real/paradas.json';
import rutasJson from './real/rutas.json';
import probabilidadesJson from './real/probabilidades.json';
import condicionesJson from './prueba/condiciones.json';

import type { CostGrid, HypothesisDef, Stop, TerrainGrid } from '@/model/types';
import type { PrecomputedRoutes } from '@/model/routes';
import { validateDataset } from './validate';
import { validateClimate } from './escenarios';

export type Condition = {
  id: string;
  nombre: string;
  valor: number | null;
  unidad: string;
  tipo: 'medición' | 'modelo' | 'histórico' | string;
  fuente: string;
};

export type Dataset = {
  fuente: string;
  tipos: TerrainGrid;
  costo: CostGrid;
  paradas: Stop[];
  rutas: PrecomputedRoutes;
  hipotesis: HypothesisDef[];
  condiciones: Condition[];
};

export const dataset: Dataset = {
  fuente: tiposJson.fuente,
  tipos: tiposJson as unknown as TerrainGrid,
  costo: costoJson as unknown as CostGrid,
  paradas: paradasJson.paradas as unknown as Stop[],
  rutas: rutasJson as unknown as PrecomputedRoutes,
  hipotesis: probabilidadesJson.hipotesis as unknown as HypothesisDef[],
  condiciones: condicionesJson.variables as unknown as Condition[],
};

/** Lista de problemas encontrados (vacía si todo cuadra). Se muestra en Misión. */
export const datasetProblems = [...validateDataset(dataset), ...validateClimate()];

export const isTestData = dataset.fuente !== 'REAL';

/** Aviso que se muestra mientras haya datos de prueba o provisionales. */
export const dataNotice =
  dataset.fuente === 'PRUEBA'
    ? 'DATOS DE PRUEBA · reemplazar por los del equipo'
    : 'ZONA REAL · costo SIG · tipos de terreno desde el TPI';
