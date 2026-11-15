// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
/**
 * Vistas orbitales de las estaciones E1–E5 (protocolo de ciencia, P01–P05).
 * Recortes del mosaico HiRISE de Curiosity en Mars Trek (NASA/JPL/University of Arizona),
 * preparados por Juan David (ciencia/entrega_juan/dia2_vistas_orbitales). La marca amarilla es la estación.
 */
import type { ImageSourcePropType } from 'react-native';

export const FOTOS: Record<string, ImageSourcePropType> = {
  e1: require('../../assets/estaciones/e1.jpg'),
  e2: require('../../assets/estaciones/e2.jpg'),
  e3: require('../../assets/estaciones/e3.jpg'),
  e4: require('../../assets/estaciones/e4.jpg'),
  e5: require('../../assets/estaciones/e5.jpg'),
};
