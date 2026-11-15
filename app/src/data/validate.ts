import type { Dataset } from './index';

/**
 * Validación ligera del contrato de datos: detecta los errores típicos al
 * integrar (tamaños distintos, paradas fuera de la grilla, hipótesis sin
 * valores iniciales). No lanza errores: devuelve mensajes legibles.
 */
export function validateDataset(d: Dataset): string[] {
  const p: string[] = [];
  const { tipos, costo } = d;
  if (tipos.celdas.length !== tipos.ancho * tipos.alto)
    p.push(`tipos.json: ${tipos.celdas.length} celdas, se esperaban ${tipos.ancho}×${tipos.alto}.`);
  if (costo.celdas.length !== costo.ancho * costo.alto)
    p.push(`costo.json: ${costo.celdas.length} celdas, se esperaban ${costo.ancho}×${costo.alto}.`);
  if (tipos.ancho !== costo.ancho || tipos.alto !== costo.alto)
    p.push('tipos.json y costo.json no tienen el mismo tamaño.');
  if (tipos.res_m !== costo.res_m) p.push('tipos.json y costo.json tienen distinta resolución.');

  const tipoIds = new Set(tipos.tipos.map((t) => t.id));
  const hipIds = new Set(d.hipotesis.map((h) => h.id));
  if (!d.paradas.some((s) => s.es_base)) p.push('paradas.json: falta la parada con "es_base": true.');

  for (const s of d.paradas) {
    if (s.fila < 0 || s.col < 0 || s.fila >= tipos.alto || s.col >= tipos.ancho) {
      p.push(`Parada ${s.id} fuera de la grilla (${s.fila}, ${s.col}).`);
      continue;
    }
    const real = tipos.celdas[s.fila * tipos.ancho + s.col];
    if (real !== s.tipo) p.push(`Parada ${s.id}: dice tipo ${s.tipo}, la grilla dice ${real}.`);
    if (costo.celdas[s.fila * costo.ancho + s.col] === costo.prohibido)
      p.push(`Parada ${s.id} está en una celda prohibida.`);
    for (const h of s.hipotesis) if (!hipIds.has(h)) p.push(`Parada ${s.id}: hipótesis ${h} no existe.`);
  }
  for (const h of d.hipotesis)
    for (const t of Object.keys(h.por_tipo))
      if (!tipoIds.has(Number(t))) p.push(`${h.id}: tipo ${t} no existe en tipos.json.`);
  return p;
}
