import type { Stop, TerrainType } from '@/model/types';

/** Datos estáticos que se envían una sola vez al mapa. */
export type MapInit = {
  ancho: number;
  alto: number;
  tipos: number[];
  costo: number[];
  prohibido: number;
  tiposDef: TerrainType[];
  paradas: Pick<Stop, 'id' | 'nombre' | 'fila' | 'col' | 'es_base'>[];
  /** Imagen de fondo (data URI) que cubre exactamente la grilla. */
  baseImage?: string;
  /** Relieve del DEM (PNG con transparencia, data URI) que cubre exactamente la grilla. */
  demImage?: string;
  /** Contorno del área de trabajo en celdas [fila, col]. */
  aoi?: [number, number][];
  /** Recorrido completo planeado (base → paradas → base) en celdas [fila, col]. */
  fullRoute?: [number, number][];
};

/** Estado que cambia (se envía con cada actualización). */
export type MapState = {
  probByType: Record<number, { p: number; u: number }>;
  currentStopId: string;
  suggestedId: string | null;
  visited: string[];
  route: { path: [number, number][]; live: boolean; alerts: [number, number][] } | null;
  layers: { base: boolean; dem: boolean; prob: boolean; full: boolean };
  showLabels: boolean;
};

/** Posición en vivo del astronauta (GPS o simulación). Se envía aparte porque cambia varias veces por segundo. */
export type WalkerState = {
  pos: [number, number];
  /** Rumbo en grados desde el norte; null si aún no se conoce. */
  heading: number | null;
  status: 'en_ruta' | 'desviado' | 'sentido_contrario' | 'llegando' | 'sin_ruta';
  /** Punto de la ruta más cercano, para dibujar la línea de regreso si está desviado. */
  closest: [number, number] | null;
  trail: [number, number][];
};

export type MapMessage =
  | { type: 'ready' }
  | { type: 'stopPress'; id: string }
  | { type: 'error'; message: string };
