import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Chip, ConnectionBadge, Label, TestDataBanner } from '@/components/ui';
import { dataset, datasetProblems } from '@/data';
import { isOnline, useMission } from '@/store/missionStore';
import { makeStyles, useColors, useThemePref, type ThemePref } from '@/theme';

export default function MissionScreen() {
  const styles = useStyles();
  const colors = useColors();
  const observations = useMission((s) => s.observations);
  const visits = useMission((s) => s.visits);
  const pending = useMission((s) => s.pending);
  const lastSync = useMission((s) => s.lastSync);
  const server = useMission((s) => s.server);
  const networkOnline = useMission((s) => s.networkOnline);
  const simulatedOffline = useMission((s) => s.simulatedOffline);
  const online = useMission(isOnline);
  const setSimulatedOffline = useMission((s) => s.setSimulatedOffline);
  const sync = useMission((s) => s.sync);
  const reset = useMission((s) => s.reset);
  const phase = useMission((s) => s.phase);

  const science = dataset.paradas.filter((s) => !s.es_base);
  const visited = new Set(visits.map((v) => v.stop_id));
  const visitedCount = science.filter((s) => visited.has(s.id)).length;
  const noDuplicates = server && server.recibidos === server.unicos;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <TestDataBanner />
      <Card>
        <Label>Misión</Label>
        <Text style={styles.big}>Boxwork · monte Sharp, cráter Gale</Text>
        <Text style={{ color: phase === 'completa' ? colors.ok : phase === 'en_curso' ? colors.accent : colors.muted, fontWeight: '700' }}>
          {phase === 'completa' ? 'Misión completa: salida y regreso a la base' : phase === 'en_curso' ? 'Misión en curso' : 'En la base, lista para salir'}
        </Text>
        <View style={styles.stats}>
          <Stat n={`${visitedCount}/${science.length}`} label="paradas visitadas" />
          <Stat n={String(observations.length)} label="observaciones" />
          <Stat n={String(pending)} label="pendientes de envío" />
        </View>
      </Card>

      <Card>
        <Label>Comunicación</Label>
        <ConnectionBadge />
        <Body muted>Red del dispositivo: {networkOnline ? 'disponible' : 'sin red'}</Body>
        <View style={styles.switchRow}>
          <Body>Simular desconexión (retraso con la Tierra)</Body>
          <Switch value={simulatedOffline} onValueChange={setSimulatedOffline} trackColor={{ true: colors.danger }} />
        </View>
        <Button label="Sincronizar ahora" disabled={!online || pending === 0} onPress={() => void sync()} />
        {lastSync && (
          <Body muted>
            Última sincronización {new Date(lastSync.at).toLocaleTimeString()}: {lastSync.enviados} enviados,{' '}
            {lastSync.fallidos} fallidos, {lastSync.pendientes} pendientes.
          </Body>
        )}
        {server && (
          <Body muted>
            Servidor simulado: {server.recibidos} recibidos, {server.unicos} únicos, {server.local} en el dispositivo
            {server.recibidos > 0 ? (noDuplicates ? ' · sin duplicados ✓' : ' · ¡hay duplicados!') : ''}
          </Body>
        )}
      </Card>

      <Card>
        <Label>Datos científicos</Label>
        <Body muted>
          Fuente: {dataset.fuente} · grilla {dataset.tipos.ancho}×{dataset.tipos.alto} celdas de {dataset.tipos.res_m} m
        </Body>
        {datasetProblems.length === 0 ? (
          <Body>Los archivos cumplen el contrato de datos ✓</Body>
        ) : (
          datasetProblems.map((p) => (
            <Text key={p} style={{ color: colors.danger }}>
              • {p}
            </Text>
          ))
        )}
      </Card>

      <AppearanceCard />

      <Button
        label="Reiniciar misión (borra datos locales)"
        color={colors.danger}
        outline
        onPress={() =>
          Alert.alert('Reiniciar misión', 'Se borran observaciones, visitas y cola de envío del dispositivo.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Reiniciar', style: 'destructive', onPress: () => void reset() },
          ])
        }
      />
    </ScrollView>
  );
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

function AppearanceCard() {
  const styles = useStyles();
  const pref = useThemePref((s) => s.pref);
  const setPref = useThemePref((s) => s.setPref);
  return (
    <Card>
      <Label>Apariencia</Label>
      <View style={styles.chips}>
        {THEME_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} active={pref === o.value} onPress={() => setPref(o.value)} />
        ))}
      </View>
      <Body muted>
        {pref === 'system' ? 'Sigue el modo claro u oscuro del teléfono.' : 'El modo oscuro cuida la vista de noche; el claro se lee mejor a pleno sol.'}
      </Body>
    </Card>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { padding: 14, gap: 12, paddingBottom: 40 },
  big: { color: colors.text, fontSize: 18, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 8 },
  statN: { color: colors.text, fontSize: 24, fontWeight: '800' },
  statL: { color: colors.muted, fontSize: 11 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
}));
