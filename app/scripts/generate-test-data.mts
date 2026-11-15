/**
 * Genera DATOS DE PRUEBA con el formato acordado del equipo.
 * Todo lo que sale de aquí lleva "fuente": "PRUEBA" y se reemplaza por los
 * archivos reales de Julián, Juan David y Anfer.
 *
 * Uso: npm run datos:prueba
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { astar } from '../src/model/astar.ts';

const OUT = new URL('../src/data/prueba/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const ANCHO = 120;
const ALTO = 120;
const RES_M = 5;
const PROHIBIDO = -1;
const PENDIENTE_MAX = 20; // grados

// Generador pseudoaleatorio con semilla (resultados reproducibles)
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

// --- Tipos de terreno tipo "boxwork": red de crestas (Voronoi) ---
const semillas = Array.from({ length: 30 }, () => ({ f: rand() * ALTO, c: rand() * ANCHO }));
const tipos = new Array<number>(ANCHO * ALTO);
const elev = new Float64Array(ANCHO * ALTO);

for (let f = 0; f < ALTO; f++) {
  for (let c = 0; c < ANCHO; c++) {
    const d = semillas.map((s) => Math.hypot(s.f - f, s.c - c)).sort((a, b) => a - b);
    const borde = d[1] - d[0]; // cerca de 0 = frontera entre celdas = cresta
    const i = f * ANCHO + c;
    const arena = Math.sin(f / 9) * Math.cos(c / 11) > 0.55 && borde > 2.5;
    tipos[i] = borde < 1.6 ? 0 : arena ? 2 : 1;
    // relieve: pendiente regional hacia el sur (monte Sharp) + crestas de ~2 m + meseta
    const crest = 2.2 * Math.exp(-(borde * borde) / 2);
    const meseta = Math.hypot(f - 35, c - 85) < 12 ? 9 : 0;
    elev[i] = 0.35 * (ALTO - f) * 0.2 + crest + meseta + rand() * 0.15;
  }
}

// --- Pendiente y costo ---
const costo = new Array<number>(ANCHO * ALTO);
const COSTO_TIPO = [2.0, 1.0, 1.6]; // cresta, hondonada, arena (ilustrativo)
for (let f = 0; f < ALTO; f++) {
  for (let c = 0; c < ANCHO; c++) {
    const i = f * ANCHO + c;
    const e = (ff: number, cc: number) =>
      elev[Math.min(ALTO - 1, Math.max(0, ff)) * ANCHO + Math.min(ANCHO - 1, Math.max(0, cc))];
    const dzdx = (e(f, c + 1) - e(f, c - 1)) / (2 * RES_M);
    const dzdy = (e(f + 1, c) - e(f - 1, c)) / (2 * RES_M);
    const pend = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    costo[i] = pend > PENDIENTE_MAX
      ? PROHIBIDO
      : Math.round((1 + 3 * (pend / PENDIENTE_MAX) ** 2 + COSTO_TIPO[tipos[i]]) * 100) / 100;
  }
}

// --- Paradas: se ajustan a la celda más cercana del tipo pedido ---
function snap(f0: number, c0: number, tipo: number) {
  let best = { fila: f0, col: c0, d: Infinity };
  for (let f = 0; f < ALTO; f++)
    for (let c = 0; c < ANCHO; c++) {
      const i = f * ANCHO + c;
      if (tipos[i] !== tipo || costo[i] === PROHIBIDO) continue;
      const d = Math.hypot(f - f0, c - c0);
      if (d < best.d) best = { fila: f, col: c, d };
    }
  return { fila: best.fila, col: best.col };
}

const base = (n: string) => `PRUEBA – ${n}`;
const def = [
  { id: 'BASE', nombre: 'Base / módulo', f: 110, c: 60, tipo: 1, hipotesis: [] as string[], es_base: true },
  { id: 'P1', nombre: base('Cresta norte'), f: 85, c: 40, tipo: 0, hipotesis: ['H1', 'H2'] },
  { id: 'P2', nombre: base('Hondonada central'), f: 70, c: 62, tipo: 1, hipotesis: ['H2', 'H3'] },
  { id: 'P3', nombre: base('Campo de arena'), f: 60, c: 25, tipo: 2, hipotesis: ['H3'] },
  { id: 'P4', nombre: base('Cresta este'), f: 75, c: 95, tipo: 0, hipotesis: ['H1', 'H2'] },
  { id: 'P5', nombre: base('Cresta lejana'), f: 25, c: 45, tipo: 0, hipotesis: ['H1', 'H2'] },
  { id: 'P6', nombre: base('Hondonada oeste'), f: 30, c: 15, tipo: 1, hipotesis: ['H2', 'H3'] },
];

const paradas = def.map((d) => {
  const s = snap(d.f, d.c, d.tipo);
  return {
    id: d.id,
    nombre: d.nombre,
    fila: s.fila,
    col: s.col,
    tipo: d.tipo,
    hipotesis: d.hipotesis,
    pregunta: d.es_base ? 'Punto de partida y regreso.' : 'PRUEBA – Juan David define la pregunta científica real.',
    que_observar: d.es_base ? '' : 'PRUEBA – Qué debe mirar el astronauta en esta parada.',
    foto: null,
    ...(d.es_base ? { es_base: true } : {}),
  };
});

// --- Rutas precalculadas entre BASE, P1–P4 (P5 y P6 quedan como "nuevas": A* en vivo) ---
const grid = { ancho: ANCHO, alto: ALTO, celdas: costo, prohibido: PROHIBIDO };
const planeadas = paradas.filter((p) => ['BASE', 'P1', 'P2', 'P3', 'P4'].includes(p.id));
const rutas: Record<string, { camino: [number, number][]; costo: number }> = {};
for (let a = 0; a < planeadas.length; a++)
  for (let b = a + 1; b < planeadas.length; b++) {
    const r = astar(grid, planeadas[a], planeadas[b]);
    if (!r) throw new Error(`Sin ruta ${planeadas[a].id}-${planeadas[b].id}`);
    rutas[`${planeadas[a].id}-${planeadas[b].id}`] = {
      camino: r.path.map((p) => [p.fila, p.col]),
      costo: Math.round(r.cost * 100) / 100,
    };
  }
for (const p of paradas) if (!astar(grid, paradas[0], p)) throw new Error(`Parada aislada: ${p.id}`);

const meta = {
  fuente: 'PRUEBA',
  nota: 'Datos sintéticos para desarrollo. Reemplazar por los productos reales.',
  orden: 'por filas; fila 0 = norte; idx = fila * ancho + col; índices desde 0',
};

const write = (name: string, data: unknown) =>
  writeFileSync(new URL(name, OUT), JSON.stringify(data) + '\n');

write('tipos.json', {
  ...meta,
  ancho: ANCHO,
  alto: ALTO,
  res_m: RES_M,
  origen: { descripcion: 'PRUEBA – sin georreferencia real (Julián entrega el CRS)' },
  tipos: [
    { id: 0, nombre: 'Cresta', color: '#E8B04B' },
    { id: 1, nombre: 'Hondonada', color: '#7A4B3A' },
    { id: 2, nombre: 'Arena', color: '#C98B5A' },
  ],
  celdas: tipos,
});
write('costo.json', { ...meta, ancho: ANCHO, alto: ALTO, res_m: RES_M, prohibido: PROHIBIDO, celdas: costo });
write('paradas.json', { ...meta, paradas });
write('rutas.json', { ...meta, rutas });
write('probabilidades.json', {
  ...meta,
  hipotesis: [
    {
      id: 'H1',
      descripcion: 'PRUEBA – Las crestas tienen una fractura central.',
      valor_cientifico: 1.0,
      por_tipo: { '0': { alpha: 2, beta: 1 } },
    },
    {
      id: 'H2',
      descripcion: 'PRUEBA – El material está cementado por minerales precipitados del agua subterránea.',
      valor_cientifico: 1.2,
      por_tipo: { '0': { alpha: 2, beta: 1 }, '1': { alpha: 2, beta: 1 } },
    },
    {
      id: 'H3',
      descripcion: 'PRUEBA – La arena proviene de la erosión de las crestas cercanas.',
      valor_cientifico: 0.8,
      por_tipo: { '1': { alpha: 2, beta: 1 }, '2': { alpha: 2, beta: 1 } },
    },
  ],
});
write('condiciones.json', {
  ...meta,
  variables: [
    { id: 'temperatura', nombre: 'Temperatura', valor: -40, unidad: '°C', tipo: 'modelo', fuente: 'PRUEBA – Anfer (MCD)' },
    { id: 'presion', nombre: 'Presión', valor: 800, unidad: 'Pa', tipo: 'modelo', fuente: 'PRUEBA – Anfer (MCD)' },
    { id: 'polvo', nombre: 'Opacidad del polvo', valor: 0.5, unidad: 'τ', tipo: 'modelo', fuente: 'PRUEBA – Anfer (MCD)' },
    { id: 'radiacion', nombre: 'Dosis de radiación', valor: null, unidad: 'µGy/día', tipo: 'medición', fuente: 'PRUEBA – Anfer (RAD)' },
    { id: 'escarcha', nombre: 'Escarcha', valor: null, unidad: '', tipo: 'modelo', fuente: 'PRUEBA – Anfer' },
  ],
});

const prohibidas = costo.filter((x) => x === PROHIBIDO).length;
console.log(`Listo: ${ANCHO}x${ALTO} celdas, ${prohibidas} prohibidas, ${Object.keys(rutas).length} rutas.`);
