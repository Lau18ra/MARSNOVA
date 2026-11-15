/**
 * Conversión entre la grilla de trabajo (fila, col) y coordenadas marcianas.
 *
 * Forma exacta (la de Julián, en tipos.json → origen):
 *   { crs: 'equirectangular', radio_m, meridiano_central_E, x_min_m, y_max_m, res_m }
 *   x = x_min + (col + 0,5)·res     y = y_max − (fila + 0,5)·res
 *   lat = (y / R)·180/π             lon_E = meridiano_central + (x / R)·180/π
 *   (cilíndrica equidistante con paralelo estándar 0°, esfera de Marte)
 *
 * Forma aproximada (datos antiguos): { lat_norte, lon_oeste_E, grados_por_celda_lat, grados_por_celda_lon }
 */
export type GridOrigin = {
  descripcion?: string;
  crs?: 'equirectangular' | string;
  radio_m?: number;
  meridiano_central_E?: number;
  x_min_m?: number;
  y_max_m?: number;
  res_m?: number;
  lat_norte?: number;
  lon_oeste_E?: number;
  grados_por_celda_lat?: number;
  grados_por_celda_lon?: number;
};

const DEG = 180 / Math.PI;

export function gridToMars(fila: number, col: number, o: GridOrigin): { lat: number; lonE: number } | null {
  if (o.crs === 'equirectangular' && o.radio_m && o.meridiano_central_E != null && o.x_min_m != null && o.y_max_m != null && o.res_m) {
    const x = o.x_min_m + (col + 0.5) * o.res_m;
    const y = o.y_max_m - (fila + 0.5) * o.res_m;
    return { lat: (y / o.radio_m) * DEG, lonE: o.meridiano_central_E + (x / o.radio_m) * DEG };
  }
  if (o.lat_norte == null || o.lon_oeste_E == null || !o.grados_por_celda_lat || !o.grados_por_celda_lon) return null;
  return {
    lat: o.lat_norte - (fila + 0.5) * o.grados_por_celda_lat,
    lonE: o.lon_oeste_E + (col + 0.5) * o.grados_por_celda_lon,
  };
}

export function formatMars(c: { lat: number; lonE: number } | null): string {
  if (!c) return 'Sin georreferencia (datos de prueba)';
  const ns = c.lat < 0 ? 'S' : 'N';
  return `${Math.abs(c.lat).toFixed(4)}° ${ns}, ${c.lonE.toFixed(4)}° E`;
}
