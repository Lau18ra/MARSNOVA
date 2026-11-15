/**
 * Tipos compartidos del modelo de MARSNOVA.
 * Convención de la grilla: arreglo plano, índices desde 0, orden por filas,
 * fila 0 = norte. idx = fila * ancho + col.
 */

export type Cell = { fila: number; col: number };

export type Grid = {
  ancho: number;
  alto: number;
  /** Tamaño de cada celda en metros (5 m en el producto real). */
  res_m: number;
  celdas: number[];
};

export type CostGrid = Grid & {
  /** Valor que marca una celda prohibida (por ejemplo, pendiente > 20°). */
  prohibido: number;
};

export type TerrainType = { id: number; nombre: string; color: string };

export type TerrainGrid = Grid & {
  tipos: TerrainType[];
  origen?: import('@/utils/coordinates').GridOrigin;
  /** Contorno del área de trabajo en coordenadas de celda [fila, col] (puede tener decimales). */
  aoi_celdas?: [number, number][];
};

export type Stop = {
  id: string;
  nombre: string;
  fila: number;
  col: number;
  /** Tipo de terreno de la parada (id de TerrainType). */
  tipo: number;
  hipotesis: string[];
  pregunta: string;
  que_observar: string;
  foto: string | null;
  es_base?: boolean;
  /** Coordenadas marcianas (planetocéntricas, longitud Este), si se conocen. */
  lat?: number;
  lon_E?: number;
};

export type BetaParams = { alpha: number; beta: number };

export type HypothesisDef = {
  id: string;
  descripcion: string;
  /** Peso científico relativo de la hipótesis (lo define Juan David). */
  valor_cientifico: number;
  /** Pregunta científica asociada (protocolo de ciencia, Q1–Q5). */
  pregunta?: string;
  /** Identificador de la pregunta en el protocolo (Q1–Q5). */
  pregunta_id?: string;
  /** Qué cuenta como Sí, No, Inconcluso y No aplica en campo. */
  criterios?: Partial<Record<ObservationResult, string>>;
  /** Probabilidad inicial por tipo de terreno: clave = id del tipo. */
  por_tipo: Record<string, BetaParams>;
};

/** no_aplica: la pregunta no aplica en ese lugar; se registra aparte y no cambia la Beta (protocolo de ciencia). */
export type ObservationResult = 'si' | 'no' | 'inconcluso' | 'no_aplica';

export type ObservationInput = {
  hypothesisId: string;
  terrainType: number;
  result: ObservationResult;
};

export type Fuente = 'PRUEBA' | string;
