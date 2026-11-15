// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
/**
 * Banner de clima espacial (NASA DONKI) y tarjeta de radiación (Curiosity RAD).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Card, Label } from '@/components/ui';
import { colors } from '@/theme';
import { MENSAJE_ALERTA, type NivelAlerta } from '@/services/donki';
import type { SpaceWeather } from '@/services/useSpaceWeather';
import {
  D_REF_UGY_DIA,
  EVENTOS_RAD,
  dosisConAlerta,
  enDiasDeFondo,
  tasaDosis,
} from '@/services/radiacion';

const fmt = (n: number, d = 0) => n.toFixed(d).replace('.', ',');

const COLOR: Record<NivelAlerta, string> = {
  normal: colors.ok,
  precaucion: colors.confirm,
  refugio: colors.danger,
};

const TITULO: Record<NivelAlerta, string> = {
  normal: 'Clima espacial: sin alertas',
  precaucion: 'Clima espacial: precaución',
  refugio: 'Clima espacial: buscar refugio',
};

const fechaCorta = (iso: string) => iso.replace('T', ' ').slice(0, 16) + ' UTC';

export function SpaceWeatherBanner({ sw }: { sw: SpaceWeather }) {
  if (sw.estado === 'cargando') {
    return (
      <Card>
        <Label>Clima espacial</Label>
        <Body muted>Consultando NASA DONKI…</Body>
      </Card>
    );
  }
  if (sw.estado === 'error') {
    return (
      <Card>
        <Label>Clima espacial</Label>
        <Body muted>No se pudo consultar NASA DONKI ({sw.error}).</Body>
        <Pressable onPress={sw.reintentar}>
          <Text style={[styles.meta, { color: colors.accent }]}>Reintentar</Text>
        </Pressable>
      </Card>
    );
  }
  const proximo = sw.impactos.find((i) => new Date(i.llegada).getTime() > sw.fecha.getTime() - 24 * 3.6e6);
  return (
    <Card style={{ borderColor: COLOR[sw.nivel] }}>
      <Label>{TITULO[sw.nivel]}</Label>
      <Body>{MENSAJE_ALERTA[sw.nivel]}</Body>
      {proximo && (
        <Text style={styles.meta}>
          Llegada estimada de una eyección de masa coronal a Marte: {fechaCorta(proximo.llegada)}
          {proximo.rozamiento ? ' (impacto de costado)' : ''}
        </Text>
      )}
      <Text style={styles.source}>
        NASA DONKI · simulaciones WSA-Enlil · consulta al {sw.fecha.toISOString().slice(0, 10)}
        {sw.demo ? ' (modo demo: tormenta solar de mayo de 2024)' : ''}
      </Text>
    </Card>
  );
}

/**
 * Dosis de la caminata: fondo de rayos cósmicos medido por RAD, ajustado con la
 * presión de la MCD (escudo atmosférico), más el evento real si hay alerta.
 */
export function RadiationCard({
  presionPa,
  horas,
  nivel,
}: {
  presionPa: number;
  horas: number;
  nivel: NivelAlerta;
}) {
  const tasa = tasaDosis(presionPa);
  const d = dosisConAlerta(presionPa, horas, nivel);
  return (
    <Card style={nivel !== 'normal' ? { borderColor: COLOR[nivel] } : undefined}>
      <Label>Radiación en la superficie</Label>
      <Text style={styles.value}>
        {fmt(d.total)} µGy <Text style={styles.small}>en {fmt(horas)} h de caminata</Text>
      </Text>
      <Text style={styles.meta}>
        Fondo: {fmt(tasa)} µGy/día con {fmt(presionPa)} Pa de presión (a más presión, más escudo).
        {' '}La caminata equivale a {fmt(enDiasDeFondo(d.total), 1)} días de fondo.
      </Text>
      {nivel !== 'normal' && (
        <View style={styles.row}>
          <Text style={[styles.meta, { color: COLOR[nivel] }]}>
            Incluye {fmt(d.extra)} µGy por el evento solar: peor caso medido por RAD el{' '}
            {EVENTOS_RAD[nivel].fecha} (pico de {fmt(EVENTOS_RAD[nivel].pico_ugy_dia)} µGy/día).
          </Text>
        </View>
      )}
      <Text style={styles.source}>
        Curiosity RAD (detector E, equivalente a tejido): fondo {D_REF_UGY_DIA} µGy/día en 2024. Ajuste por
        presión de Guo et al. (−0,13 µGy/día por Pa). Valor para toda la zona, no por píxel.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  value: { color: colors.text, fontSize: 24, fontWeight: '800' },
  small: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  meta: { color: colors.muted, fontSize: 12 },
  source: { color: colors.muted, fontSize: 11, marginTop: 4 },
  row: { marginTop: 2 },
});
