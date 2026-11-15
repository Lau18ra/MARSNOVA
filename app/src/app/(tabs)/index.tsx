import { useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { useEvaProfile } from '@/store/evaProfile';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MarsMap } from '@/components/MarsMap';
import { NavPanel } from '@/components/NavPanel';
import { useLiveNav } from '@/store/useLiveNav';
import { Button, Card, Chip, ConnectionBadge, Label, TestDataBanner } from '@/components/ui';
import { dataset } from '@/data';
import { beliefKey, betaMean, uncertainty01 } from '@/model/beta';
import type { MapState } from '@/map/bridge';
import { baseStop, getStop, useMission } from '@/store/missionStore';
import { DEM_RANGE } from '@/map/demImage';
import { colors, pct } from '@/theme';

/** Misma rampa (viridis) que usa scripts/build_dem_layer.py: bajo → alto. */
const DEM_RAMP = ['#440154', '#31688E', '#35B779', '#FDE725'];

function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const beliefs = useMission((s) => s.beliefs);
  const currentStopId = useMission((s) => s.currentStopId);
  const visits = useMission((s) => s.visits);
  const route = useMission((s) => s.route);
  const suggestions = useMission((s) => s.suggestions);
  const selectedHypothesisId = useMission((s) => s.selectedHypothesisId);
  const selectHypothesis = useMission((s) => s.selectHypothesis);
  const planRoute = useMission((s) => s.planRoute);
  const planReturn = useMission((s) => s.planReturn);
  const markArrival = useMission((s) => s.markArrival);
  const phase = useMission((s) => s.phase);
  const shouldReturn = useMission((s) => s.shouldReturn);
  const returnReason = useMission((s) => s.returnReason);
  const observations = useMission((s) => s.observations);
  const reset = useMission((s) => s.reset);
  const [layers, setLayers] = useState({ base: true, dem: false, prob: true, full: true });
  const [showLabels, setShowLabels] = useState(true);
  const { nav, walker } = useLiveNav();

  const top = suggestions[0];
  const hyp = dataset.hipotesis.find((h) => h.id === selectedHypothesisId);

  const mapState: MapState = useMemo(() => {
    const probByType: MapState['probByType'] = {};
    if (hyp)
      for (const t of Object.keys(hyp.por_tipo)) {
        const b = beliefs[beliefKey(hyp.id, Number(t))];
        if (b) probByType[Number(t)] = { p: betaMean(b), u: uncertainty01(b) };
      }
    return {
      probByType,
      currentStopId,
      suggestedId: shouldReturn ? baseStop.id : top && top.score > 0 ? top.stop.id : null,
      visited: Array.from(new Set(visits.map((v) => v.stop_id))),
      route: route
        ? {
            path: route.path.map((c) => [c.fila, c.col] as [number, number]),
            live: route.origen === 'A* en vivo',
            alerts: route.alertas.map((a) => [a.fila, a.col] as [number, number]),
          }
        : null,
      layers,
      showLabels,
    };
  }, [hyp, beliefs, currentStopId, top, visits, route, layers, showLabels, shouldReturn]);

  const routeTo = getStop(route?.toId);
  // Se recuerda qué ruta se minimizó: una ruta nueva aparece desplegada.
  const routeKey = route ? `${route.fromId}-${route.toId}` : null;
  const [collapsedKey, setCollapsedKey] = useState<string | null>(null);
  const routeCollapsed = routeKey !== null && collapsedKey === routeKey;
  const toggleRoute = () => setCollapsedKey(routeCollapsed ? null : routeKey);

  return (
    <View style={styles.screen}>
      <MarsMap state={mapState} walker={walker} onStopPress={(id) => router.push({ pathname: '/parada/[id]', params: { id } })} />

      {/* Barra superior */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.row} pointerEvents="box-none">
          <Text style={styles.brand}>MARSNOVA</Text>
          <ConnectionBadge />
        </View>
        <TestDataBanner />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {dataset.hipotesis.map((h) => (
            <Chip key={h.id} label={h.id} active={h.id === selectedHypothesisId} onPress={() => selectHypothesis(h.id)} />
          ))}
          <View style={styles.sep} />
          <Chip label="Terreno" active={layers.base} onPress={() => setLayers((l) => ({ ...l, base: !l.base }))} />
          <Chip label="Relieve" active={layers.dem} onPress={() => setLayers((l) => ({ ...l, dem: !l.dem }))} />
          <Chip label="Probabilidad" active={layers.prob} onPress={() => setLayers((l) => ({ ...l, prob: !l.prob }))} />
          <Chip label="Ruta completa" active={layers.full} onPress={() => setLayers((l) => ({ ...l, full: !l.full }))} />
          <Chip label="Etiquetas" active={showLabels} onPress={() => setShowLabels((v) => !v)} />
        </ScrollView>
        {hyp && layers.prob && (
          <View style={styles.legend}>
            <Text style={styles.legendHyp} numberOfLines={2}>{hyp.id}: {hyp.descripcion.replace('PRUEBA – ', '')}</Text>
            <View style={styles.legendBar}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.contradict }]} />
              <Text style={styles.legendText}>desfavorable</Text>
              <View style={[styles.legendSwatch, { backgroundColor: colors.neutral }]} />
              <Text style={styles.legendText}>50 %</Text>
              <View style={[styles.legendSwatch, { backgroundColor: colors.confirm }]} />
              <Text style={styles.legendText}>favorable · transparente = incierto</Text>
            </View>
          </View>
        )}
        {layers.dem && (
          <View style={styles.legend}>
            <Text style={styles.legendHyp}>Relieve · DEM HiRISE 10 m</Text>
            <View style={styles.legendBar}>
              <Text style={styles.legendText}>{DEM_RANGE.min} m</Text>
              <View style={styles.demRamp}>
                {DEM_RAMP.map((c) => (
                  <View key={c} style={{ flex: 1, backgroundColor: c }} />
                ))}
              </View>
              <Text style={styles.legendText}>{DEM_RANGE.max} m</Text>
            </View>
          </View>
        )}
      </View>

      {/* Tarjeta inferior */}
      <View style={styles.bottom} pointerEvents="box-none">
        {phase === 'completa' ? (
          <Card style={{ borderColor: colors.ok }}>
            <Label>Misión completa</Label>
            <Text style={styles.cardTitle}>De vuelta en {baseStop.nombre.replace('PRUEBA – ', '')}</Text>
            <Text style={styles.meta}>
              {new Set(visits.filter((v) => !getStop(v.stop_id)?.es_base).map((v) => v.stop_id)).size} paradas visitadas ·{' '}
              {observations.length} observaciones registradas
            </Text>
            <View style={styles.row}>
              <Button label="Ver resultados" onPress={() => router.push('/ciencia')} style={{ flex: 1 }} />
              <Button
                label="Nueva misión"
                outline
                onPress={() =>
                  Alert.alert('Nueva misión', 'Se borran las observaciones y visitas de esta misión en el dispositivo.', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Empezar', style: 'destructive', onPress: () => void reset() },
                  ])
                }
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : route && routeTo ? (
          <Card style={routeTo.es_base ? { borderColor: colors.accent } : undefined}>
            <Pressable
              onPress={toggleRoute}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={routeCollapsed ? 'Desplegar ruta activa' : 'Minimizar ruta activa'}
              accessibilityState={{ expanded: !routeCollapsed }}
              style={styles.collapseHeader}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Label>{routeTo.es_base ? 'Regreso a la base' : 'Ruta activa'} · {route.origen}</Label>
                <Text style={styles.cardTitle} numberOfLines={routeCollapsed ? 1 : undefined}>
                  Hacia {routeTo.nombre.replace('PRUEBA – ', '')}
                </Text>
                <Text style={styles.meta}>
                  {Math.round(route.lengthCells * dataset.costo.res_m)} m · costo {route.cost.toFixed(0)}
                  {routeCollapsed && route.alertas.length > 0 ? ` · ⚠ ${route.alertas.length}` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>{routeCollapsed ? '▴' : '▾'}</Text>
            </Pressable>
            {!routeCollapsed && (
              <>
            {route.alertas.length > 0 && (
              <Text style={[styles.meta, { color: colors.danger }]}>
                ⚠ {route.alertas.length} {route.alertas.length === 1 ? 'tramo' : 'tramos'} de 10 m con pendiente &gt; 20° (
                {route.alertas.map((a) => `${a.pendiente_grados}°`).join(', ')}). Pasar con precaución.
              </Text>
            )}
            <View style={styles.row}>
              {routeTo.es_base ? (
                <Button label="Llegué a la base" onPress={() => void markArrival(routeTo.id)} style={{ flex: 1 }} />
              ) : (
                <Button label="Abrir parada" onPress={() => router.push({ pathname: '/parada/[id]', params: { id: routeTo.id } })} style={{ flex: 1 }} />
              )}
              <Button label="Quitar ruta" outline onPress={() => planRoute(currentStopId)} style={{ flex: 1 }} />
            </View>
            <NavPanel nav={nav} />
              </>
            )}
          </Card>
        ) : shouldReturn ? (
          <Card style={{ borderColor: colors.accent }}>
            <Label>Hora de volver a la base</Label>
            <Text style={styles.cardTitle}>{returnReason}</Text>
            <View style={styles.row}>
              <Button label="Trazar regreso" onPress={planReturn} style={{ flex: 1 }} />
              {top && top.score > 0 && (
                <Button label="Seguir explorando" outline onPress={() => planRoute(top.stop.id)} style={{ flex: 1 }} />
              )}
            </View>
          </Card>
        ) : top && top.score > 0 ? (
          <Card>
            <Label>{phase === 'en_base' ? 'Primera parada sugerida' : 'Siguiente parada sugerida'}</Label>
            <Text style={styles.cardTitle}>{top.stop.nombre.replace('PRUEBA – ', '')}</Text>
            <Text style={styles.meta}>
              {dataset.tipos.tipos.find((t) => t.id === top.stop.tipo)?.nombre} ·{' '}
              {top.detalle.hipotesis.map((h) => `${h.id} ${pct(h.probabilidad)}`).join(' · ')}
              {top.detalle.visitasTipo > 0 ? ` · tipo visitado ${top.detalle.visitasTipo}×` : ''}
            </Text>
            <View style={styles.row}>
              <Button label="Trazar ruta" onPress={() => planRoute(top.stop.id)} style={{ flex: 1 }} />
              <Button label="Ver parada" outline onPress={() => router.push({ pathname: '/parada/[id]', params: { id: top.stop.id } })} style={{ flex: 1 }} />
            </View>
            {phase === 'en_curso' && (
              <Button label="Volver a la base" outline color={colors.muted} onPress={planReturn} style={{ marginTop: 2, paddingVertical: 8 }} />
            )}
          </Card>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { color: colors.text, fontWeight: '900', letterSpacing: 3, fontSize: 16 },
  chips: { gap: 6, alignItems: 'center', paddingRight: 12 },
  sep: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 },
  legend: { backgroundColor: 'rgba(11,13,18,0.85)', borderRadius: 10, padding: 8, gap: 4, borderColor: colors.border, borderWidth: 1 },
  legendHyp: { color: colors.text, fontSize: 12, fontWeight: '600' },
  legendBar: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.muted, fontSize: 10, marginRight: 6 },
  demRamp: { flex: 1, height: 8, borderRadius: 2, overflow: 'hidden', flexDirection: 'row', marginRight: 6 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { color: colors.muted, fontSize: 20, paddingHorizontal: 4 },
});

/** El mapa se abre después de la pestaña Preparación (perfil del astronauta confirmado). */
export default function MapTab() {
  const confirmado = useEvaProfile((st) => st.confirmado);
  if (!confirmado) return <Redirect href="/preparacion" />;
  return <MapScreen />;
}
