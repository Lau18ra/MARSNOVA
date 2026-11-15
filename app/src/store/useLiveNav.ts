import { useEffect, useMemo, useRef } from 'react';
import * as Speech from 'expo-speech';
import { dataset } from '@/data';
import type { WalkerState } from '@/map/bridge';
import { navigate, type NavInfo, type NavStatus } from '@/model/tracking';
import { useMission } from '@/store/missionStore';
import { useTracking } from '@/store/trackingStore';

const VOICE: Partial<Record<NavStatus, string>> = {
  desviado: 'Te saliste de la ruta.',
  sentido_contrario: 'Vas en sentido contrario.',
  llegando: 'Estás llegando a la parada.',
};

/**
 * Une la posición en vivo con la ruta activa: calcula la navegación, prepara lo
 * que dibuja el mapa y avisa por voz cuando cambia el estado.
 */
export function useLiveNav(): { nav: NavInfo | null; walker: WalkerState | null } {
  const route = useMission((s) => s.route);
  const mode = useTracking((s) => s.mode);
  const pos = useTracking((s) => s.pos);
  const heading = useTracking((s) => s.heading);
  const trail = useTracking((s) => s.trail);

  const path = route?.path;

  // La simulación sigue la ruta activa: si cambia, vuelve a empezar; si se quita, se detiene.
  useEffect(() => {
    const t = useTracking.getState();
    if (t.mode !== 'sim') return;
    if (path && path.length > 1) t.startSim(path);
    else t.stop();
  }, [path]);

  const nav = useMemo(
    () => (pos && path && path.length > 1 ? navigate(pos, path, heading, dataset.costo.res_m) : null),
    [pos, path, heading],
  );

  const walker = useMemo<WalkerState | null>(
    () =>
      mode === 'off' || !pos
        ? null
        : {
            pos: [pos.fila, pos.col],
            heading,
            status: nav?.status ?? 'sin_ruta',
            closest: nav ? [nav.closest.fila, nav.closest.col] : null,
            trail: trail.map((p) => [p.fila, p.col] as [number, number]),
          },
    [mode, pos, heading, nav, trail],
  );

  // Aviso por voz al cambiar de estado (el astronauta no siempre mira la pantalla).
  const prev = useRef<NavStatus | null>(null);
  const status = nav?.status ?? null;
  useEffect(() => {
    const before = prev.current;
    prev.current = status;
    if (mode === 'off' || !status || status === before || before == null) return;
    const text = VOICE[status] ?? (status === 'en_ruta' && (before === 'desviado' || before === 'sentido_contrario') ? 'De vuelta en la ruta.' : null);
    if (text) {
      Speech.stop();
      Speech.speak(text, { language: 'es' });
    }
  }, [status, mode]);

  return { nav, walker };
}
