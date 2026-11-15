// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
// Radiación en superficie para la zona de trabajo (cráter Gale).
//
// Fondo: rayos cósmicos medidos por RAD (Curiosity), detector E (equivalente a tejido).
// Escudo atmosférico: la dosis baja cuando sube la presión
//   D(P) = D_REF + KAPPA * (P - P_REF)
//   KAPPA = -0.13 µGy/día/Pa (Guo et al., primer año marciano de RAD, 2012–2014)
//   D_REF ≈ 164 µGy/día: fondo medido por RAD (detector E), 1–3 sept. 2024, máximo solar
//           (en 2012–2014 era ≈ 220: el fondo cambia con el ciclo solar)
//   P_REF ≈ 818 Pa (presión media anual en la zona, MCD v6.2 web)
// Es un valor para toda la zona según estación y hora, NO un mapa por píxel.

export const D_REF_UGY_DIA = 164;
export const KAPPA_UGY_DIA_PA = -0.13;
export const P_REF_PA = 818;

// Evento real para la demo: tormenta solar del 20 de mayo de 2024 medida por RAD.
// Eventos reales medidos por RAD, usados según el nivel de alerta de DONKI.
// Exceso = dosis extra sobre el fondo durante todo el evento.
export const EVENTOS_RAD = {
  precaucion: { fecha: '2024-09-05', pico_ugy_dia: 304, exceso_ugy: 45, fuente: 'RAD, detector E' },
  // Calculado con los datos de RAD (detector E), 20–23 may. 2024: inicio 05:39 UTC,
  // pico de 8378 µGy/día a las 06:15 UTC, exceso acumulado ≈ 1730 µGy.
  refugio: { fecha: '2024-05-20', pico_ugy_dia: 8378, exceso_ugy: 1730, fuente: 'RAD, detector E' },
} as const;

/**
 * Dosis estimada de una caminata combinando las tres fuentes:
 * fondo (RAD) ajustado por presión (MCD) + peor caso del evento si DONKI alerta.
 */
export function dosisConAlerta(
  presionPa: number,
  horas: number,
  nivel: 'normal' | 'precaucion' | 'refugio',
) {
  const fondo = dosisCaminata(presionPa, horas);
  const extra = nivel === 'normal' ? 0 : EVENTOS_RAD[nivel].exceso_ugy;
  return { fondo, extra, total: fondo + extra };
}

/** Tasa de dosis de fondo (µGy/día) para una presión dada (Pa). */
export function tasaDosis(presionPa: number): number {
  return D_REF_UGY_DIA + KAPPA_UGY_DIA_PA * (presionPa - P_REF_PA);
}

/** Dosis acumulada (µGy) en una caminata de `horas` horas a presión `presionPa`. */
export function dosisCaminata(presionPa: number, horas: number): number {
  return (tasaDosis(presionPa) * horas) / 24;
}

/** Dosis expresada en días de fondo: "esta caminata equivale a N días normales en Marte". */
export function enDiasDeFondo(dosisUgy: number): number {
  return dosisUgy / D_REF_UGY_DIA;
}
