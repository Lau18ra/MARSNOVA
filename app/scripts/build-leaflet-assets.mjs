// Copia Leaflet dentro del código de la app para que el mapa funcione SIN internet.
// Uso: node scripts/build-leaflet-assets.mjs (ya se corrió; repetir solo si se actualiza Leaflet)
import { readFileSync, writeFileSync } from 'node:fs';
const js = readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const css = readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const out =
  '/* Archivo generado por scripts/build-leaflet-assets.mjs — no editar a mano. Leaflet 1.9.4 (BSD-2). */\n' +
  `export const LEAFLET_JS = ${JSON.stringify(js)};\n` +
  `export const LEAFLET_CSS = ${JSON.stringify(css)};\n`;
writeFileSync('src/map/leafletAssets.ts', out);
console.log('src/map/leafletAssets.ts', (out.length / 1024).toFixed(0), 'KB');
