// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
/**
 * Perfil del astronauta para la caminata (pestaña Preparación). Se guarda en el
 * teléfono para que siga disponible sin conexión y al reabrir la app.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import recursosJson from '@/data/real/recursos_eva.json';
import { planEva, type PerfilAstronauta, type PlanEva, type RecursosEva } from '@/model/eva';
import type { NivelAlerta } from '@/services/donki';

export const recursos = recursosJson as unknown as RecursosEva;

type EvaState = PerfilAstronauta & {
  /** El astronauta revisó y confirmó su perfil. */
  confirmado: boolean;
  setMasaCorporal: (kg: number) => void;
  toggleHerramienta: (id: string) => void;
  setCargaExtra: (kg: number) => void;
  confirmar: () => void;
};

export const useEvaProfile = create<EvaState>()(
  persist(
    (set) => ({
      masaCorporalKg: 75,
      herramientas: ['martillo', 'bolsas', 'camara'],
      cargaExtraKg: 0,
      confirmado: false,
      setMasaCorporal: (kg) => set({ masaCorporalKg: Math.max(30, Math.min(150, Math.round(kg))), confirmado: false }),
      toggleHerramienta: (id) =>
        set((s) => ({
          herramientas: s.herramientas.includes(id) ? s.herramientas.filter((h) => h !== id) : [...s.herramientas, id],
          confirmado: false,
        })),
      setCargaExtra: (kg) => set({ cargaExtraKg: Math.max(0, Math.min(60, Math.round(kg))), confirmado: false }),
      confirmar: () => set({ confirmado: true }),
    }),
    {
      name: 'marsnova.perfil_eva.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // La confirmación no se guarda: cada vez que se abre la app, el astronauta revisa su perfil antes del mapa.
      partialize: ({ masaCorporalKg, herramientas, cargaExtraKg }) => ({ masaCorporalKg, herramientas, cargaExtraKg }),
    },
  ),
);

/** Plan calculado con el perfil actual. */
export function usePlanEva(nivel: NivelAlerta = 'normal'): PlanEva {
  const masaCorporalKg = useEvaProfile((s) => s.masaCorporalKg);
  const herramientas = useEvaProfile((s) => s.herramientas);
  const cargaExtraKg = useEvaProfile((s) => s.cargaExtraKg);
  return planEva(recursos, { masaCorporalKg, herramientas, cargaExtraKg }, nivel);
}

/** Velocidad de marcha del perfil actual, en m/s (para la simulación del mapa). */
export function velocidadPerfilMps(): number {
  const s = useEvaProfile.getState();
  return planEva(recursos, s).velocidadKmh / 3.6;
}
