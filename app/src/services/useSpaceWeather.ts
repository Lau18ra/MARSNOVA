// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
/**
 * Estado del clima espacial para la app (NASA DONKI, simulaciones WSA-Enlil).
 * En modo demo (EXPO_PUBLIC_MODO_DEMO=true) consulta la API real con una fecha
 * histórica: el 20 de mayo de 2024, el evento solar más fuerte medido por RAD.
 */
import { useCallback, useEffect, useState } from 'react';
import { consultarAlerta, type ImpactoMarte, type NivelAlerta } from './donki';

export const MODO_DEMO = process.env.EXPO_PUBLIC_MODO_DEMO === 'true';
export const FECHA_DEMO = new Date('2024-05-20T05:00:00Z');

export type SpaceWeather = {
  estado: 'cargando' | 'listo' | 'error';
  nivel: NivelAlerta;
  impactos: ImpactoMarte[];
  fecha: Date;
  demo: boolean;
  error?: string;
  reintentar: () => void;
};

export function useSpaceWeather(): SpaceWeather {
  const [fecha] = useState(() => (MODO_DEMO ? FECHA_DEMO : new Date()));
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<SpaceWeather['estado']>('cargando');
  const [nivel, setNivel] = useState<NivelAlerta>('normal');
  const [impactos, setImpactos] = useState<ImpactoMarte[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    consultarAlerta(fecha)
      .then((r) => {
        if (!vivo) return;
        setNivel(r.nivel);
        setImpactos(r.impactos);
        setEstado('listo');
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : String(e));
        setEstado('error');
      });
    return () => {
      vivo = false;
    };
  }, [fecha, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { estado, nivel, impactos, fecha, demo: MODO_DEMO, error, reintentar };
}
