import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/ui';
import type { NavInfo } from '@/model/tracking';
import { compassLabel } from '@/model/tracking';
import { getStop, useMission } from '@/store/missionStore';
import { useTracking } from '@/store/trackingStore';
import { colors } from '@/theme';

const STATUS: Record<NavInfo['status'], { label: string; color: string }> = {
  en_ruta: { label: 'En la ruta', color: colors.ok },
  llegando: { label: 'Llegando a la parada', color: colors.accent },
  desviado: { label: 'Fuera de la ruta', color: colors.danger },
  sentido_contrario: { label: 'Sentido contrario', color: colors.confirm },
};

function instruction(nav: NavInfo): string {
  const dir = `${Math.round(nav.targetBearing)}° ${compassLabel(nav.targetBearing)}`;
  if (nav.status === 'llegando') return 'La parada está a pocos metros.';
  if (nav.status === 'desviado') return `Estás a ${Math.round(nav.offRouteM)} m de la ruta. Vuelve hacia el ${dir}.`;
  if (nav.status === 'sentido_contrario') return `Da la vuelta: la ruta sigue hacia el ${dir}.`;
  if (nav.turnDeg == null) return `Sigue hacia el ${dir}.`;
  if (Math.abs(nav.turnDeg) < 20) return `Sigue derecho (${dir}).`;
  return `Gira ${Math.round(Math.abs(nav.turnDeg))}° a la ${nav.turnDeg > 0 ? 'derecha' : 'izquierda'} (${dir}).`;
}

/** Controles de seguimiento (GPS / simulación) y la guía de navegación en vivo. */
export function NavPanel({ nav }: { nav: NavInfo | null }) {
  const route = useMission((s) => s.route);
  const currentStopId = useMission((s) => s.currentStopId);
  const mode = useTracking((s) => s.mode);
  const sim = useTracking((s) => s.sim);
  const accuracyM = useTracking((s) => s.accuracyM);
  const headingSource = useTracking((s) => s.headingSource);
  const anchor = useTracking((s) => s.anchor);
  const error = useTracking((s) => s.error);
  const t = useTracking.getState();

  const here = getStop(currentStopId);
  const startGps = () => here && void t.startGps({ fila: here.fila, col: here.col });
  const startSim = () => route && t.startSim(route.path);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.small}>Seguimiento</Text>
        <Chip label="GPS" active={mode === 'gps'} onPress={mode === 'gps' ? t.stop : startGps} />
        <Chip label="Simular" active={mode === 'sim'} onPress={mode === 'sim' ? t.stop : startSim} />
      </View>

      {mode === 'gps' && (
        <Text style={styles.small}>
          {anchor
            ? `Ancla: ${here?.nombre.replace('PRUEBA – ', '') ?? 'parada actual'} = punto donde activaste el GPS · ±${Math.round(accuracyM ?? 0)} m · rumbo por ${headingSource ?? '…'}`
            : 'Esperando señal GPS… Quédate en la parada actual: ese punto será el ancla.'}
        </Text>
      )}

      {mode === 'sim' && sim && (
        <View style={styles.row}>
          <Chip label="Desviarse 40 m" onPress={t.simDeviate} />
          <Chip label="Dar la vuelta" onPress={t.simTurnAround} />
          <Chip label="Corregir" onPress={t.simCorrect} />
          <Chip label={`${sim.speed}×`} onPress={t.simCycleSpeed} />
        </View>
      )}

      {mode !== 'off' && nav && (
        <View style={[styles.guide, { borderColor: STATUS[nav.status].color }]}>
          <View style={styles.row}>
            <Text style={[styles.status, { color: STATUS[nav.status].color }]}>{STATUS[nav.status].label}</Text>
            <Text style={styles.small}>
              faltan {Math.round(nav.remainingM)} m · {Math.round(nav.progress * 100)} %
            </Text>
          </View>
          <Text style={styles.text}>{instruction(nav)}</Text>
        </View>
      )}

      {mode === 'gps' && anchor && here && (
        <Chip label="Recalibrar: estoy en la parada de salida" onPress={() => t.recalibrate({ fila: here.fila, col: here.col })} />
      )}

      {error && <Text style={[styles.small, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  small: { color: colors.muted, fontSize: 12 },
  guide: { borderWidth: 1, borderRadius: 10, padding: 8, gap: 4, backgroundColor: colors.surface2 },
  status: { fontWeight: '700', fontSize: 14, flex: 1 },
  text: { color: colors.text, fontSize: 14 },
});
