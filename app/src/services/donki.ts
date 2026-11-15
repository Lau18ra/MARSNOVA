// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
// Clima espacial desde NASA DONKI.
//
// Lo que importa para Marte son las simulaciones WSA-Enlil: propagan cada
// eyección de masa coronal (CME) por el sistema solar y dicen si llega a Marte
// y cuándo (impactList con location = "Mars").
//
// Clave: pide una gratis en https://api.nasa.gov y ponla en .env.local como
//   EXPO_PUBLIC_NASA_API_KEY=tu_clave
// (DEMO_KEY sirve para pruebas, pero solo permite ~30 peticiones por hora.)
// .env.local ya está en el .gitignore de Expo: no se sube al repositorio.

const BASE = 'https://api.nasa.gov/DONKI';
const API_KEY = process.env.EXPO_PUBLIC_NASA_API_KEY ?? 'DEMO_KEY';

export type ImpactoMarte = {
  llegada: string;          // ISO, hora estimada de llegada a Marte
  rozamiento: boolean;      // isGlancingBlow: impacto de costado (más débil)
  cme: string | null;       // activityID de la CME que lo origina
  enlace: string | null;    // página del evento en DONKI
};

export type NivelAlerta = 'normal' | 'precaucion' | 'refugio';

function fecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Impactos de CME en Marte simulados entre `desde` y `hasta`. */
export async function impactosEnMarte(desde: Date, hasta: Date): Promise<ImpactoMarte[]> {
  const url =
    `${BASE}/WSAEnlilSimulations?startDate=${fecha(desde)}` +
    `&endDate=${fecha(hasta)}&api_key=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`DONKI respondió ${r.status}`);
  const sims: any[] = await r.json();

  const impactos: ImpactoMarte[] = [];
  for (const sim of sims ?? []) {
    for (const imp of sim.impactList ?? []) {
      if (typeof imp.location === 'string' && imp.location.toLowerCase().includes('mars')) {
        impactos.push({
          llegada: imp.arrivalTime,
          rozamiento: Boolean(imp.isGlancingBlow),
          cme: sim.cmeInputs?.[0]?.cmeStartTime ?? null,
          enlace: sim.link ?? null,
        });
      }
    }
  }
  // Una misma CME puede aparecer en varias simulaciones: quedarse con una por hora de llegada.
  const unicos = new Map(impactos.map((i) => [i.llegada, i]));
  return [...unicos.values()].sort((a, b) => a.llegada.localeCompare(b.llegada));
}

/** Nivel de alerta según el impacto más próximo. */
export function nivelAlerta(impactos: ImpactoMarte[], ahora = new Date()): NivelAlerta {
  const horas = impactos
    .map((i) => (new Date(i.llegada).getTime() - ahora.getTime()) / 3.6e6)
    .filter((h) => h > -24); // incluye eventos que llegaron en las últimas 24 h
  if (horas.some((h) => h <= 12)) return 'refugio';   // llega pronto o ya está pasando
  if (horas.some((h) => h <= 72)) return 'precaucion';
  return 'normal';
}

/**
 * Consulta completa para la app.
 * `ahora` es la fecha "de la caminata": la fecha real en uso normal, o una fecha
 * histórica en modo demo (p. ej. 2024-09-02 o 2024-05-18). La API acepta fechas pasadas.
 * Las simulaciones se filtran por la fecha en que se corrieron, y una CME tarda
 * días en llegar a Marte, por eso se buscan las de los 7 días anteriores.
 */
export async function consultarAlerta(ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 7 * 24 * 3.6e6);
  const impactos = await impactosEnMarte(desde, ahora);
  return { nivel: nivelAlerta(impactos, ahora), impactos };
}

export const MENSAJE_ALERTA: Record<NivelAlerta, string> = {
  normal: 'Sin eventos solares hacia Marte.',
  precaucion: 'Eyección solar en camino a Marte: planifica caminatas cortas.',
  refugio: 'Evento solar llegando a Marte: vuelve al refugio.',
};
