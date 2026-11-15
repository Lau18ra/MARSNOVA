/**
 * Tema de la app: paletas clara y oscura, preferencia del usuario (Sistema /
 * Claro / Oscuro, guardada en el teléfono) y utilidades para estilos.
 *
 * Uso en componentes:
 *   const c = useColors();                 // colores del esquema activo
 *   const styles = useStyles();            // con useStyles = makeStyles((c) => ({ ... }))
 */
import { StyleSheet, useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const dark = {
  bg: '#0B0D12',
  surface: '#141822',
  surface2: '#1B2030',
  border: '#272D3D',
  text: '#F3EDE4',
  muted: '#9AA3B2',
  accent: '#4FD1C5',
  /** Fondo tenue del acento (ventanas resaltadas). */
  accentSoft: 'rgba(79,209,197,0.12)',
  mars: '#E4572E',
  confirm: '#FF8C32',
  contradict: '#3FA7D6',
  neutral: '#9696A0',
  danger: '#E5484D',
  ok: '#46A758',
  /** Texto sobre botones/chips rellenos con un color de estado. */
  onColor: '#0B0D12',
  /** Fondo semitransparente de elementos flotantes sobre el mapa. */
  overlay: 'rgba(11,13,18,0.85)',
  /** Intervalo de incertidumbre en las barras de probabilidad. */
  range: '#3A4152',
  warnBg: '#3B2A10',
  warnBorder: '#8A6420',
  warnText: '#F5C26B',
};

export type Colors = typeof dark;

/** Variantes más oscuras de los colores de estado para mantener contraste sobre fondo claro. */
const light: Colors = {
  bg: '#F6F3EE',
  surface: '#FFFFFF',
  surface2: '#EEE9E1',
  border: '#DCD4C8',
  text: '#1A1D24',
  muted: '#5C6473',
  accent: '#0E7F77',
  accentSoft: 'rgba(14,127,119,0.12)',
  mars: '#C8431C',
  confirm: '#C2560F',
  contradict: '#1F75A8',
  neutral: '#6B6B75',
  danger: '#C62F33',
  ok: '#2D7F3B',
  onColor: '#FFFFFF',
  overlay: 'rgba(255,255,255,0.9)',
  range: '#CBC2B4',
  warnBg: '#FDF1D8',
  warnBorder: '#D9A441',
  warnText: '#7A4E00',
};

export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | Scheme;

export const palettes: Record<Scheme, Colors> = { light, dark };

export const useThemePref = create<{ pref: ThemePref; setPref: (p: ThemePref) => void }>()(
  persist(
    (set) => ({
      pref: 'system',
      setPref: (pref) => set({ pref }),
    }),
    { name: 'marsnova.tema.v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Esquema activo: la preferencia del usuario o, en "Sistema", la del teléfono (oscuro si no se sabe). */
export function useScheme(): Scheme {
  const pref = useThemePref((s) => s.pref);
  const system = useColorScheme();
  if (pref !== 'system') return pref;
  return system === 'light' ? 'light' : 'dark';
}

export function useColors(): Colors {
  return palettes[useScheme()];
}

/** Crea un hook de estilos que depende de la paleta; se calcula una vez por esquema. */
type StylesInput = Parameters<typeof StyleSheet.create>[0];

export function makeStyles<S extends StylesInput>(factory: (c: Colors) => S): () => Readonly<S> {
  const cache: Partial<Record<Scheme, Readonly<S>>> = {};
  return function useStyles() {
    const scheme = useScheme();
    return (cache[scheme] ??= StyleSheet.create(factory(palettes[scheme])));
  };
}

export const pct = (p: number) => `${Math.round(p * 100)} %`;

export const RESULT_LABEL = { si: 'Sí', no: 'No', inconcluso: 'Inconcluso', no_aplica: 'No aplica' } as const;
