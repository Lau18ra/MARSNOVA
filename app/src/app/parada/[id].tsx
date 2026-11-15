import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Card, Label, ProbBar, TestDataBanner } from '@/components/ui';
import { dataset } from '@/data';
import { beliefKey, betaInterval95, betaMean } from '@/model/beta';
import type { ObservationResult } from '@/model/types';
import { formatMars, gridToMars } from '@/utils/coordinates';
import { getStop, useMission } from '@/store/missionStore';
import { colors, pct, RESULT_LABEL } from '@/theme';

export default function StopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const stop = getStop(id);
  const beliefs = useMission((s) => s.beliefs);
  const observations = useMission((s) => s.observations);
  const currentStopId = useMission((s) => s.currentStopId);
  const recordObservation = useMission((s) => s.recordObservation);
  const planRoute = useMission((s) => s.planRoute);
  const markArrival = useMission((s) => s.markArrival);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!stop) return <Body>Parada no encontrada.</Body>;

  const tipo = dataset.tipos.tipos.find((t) => t.id === stop.tipo);
  const here = currentStopId === stop.id;
  const coords = gridToMars(stop.fila, stop.col, dataset.tipos.origen ?? {});

  const record = async (hypothesisId: string, result: ObservationResult) => {
    const key = beliefKey(hypothesisId, stop.tipo);
    const before = beliefs[key] ? betaMean(beliefs[key]) : null;
    setSaving(true);
    try {
      await recordObservation({ stopId: stop.id, hypothesisId, result, note: note.trim() });
      const after = useMission.getState().beliefs[key];
      setNote('');
      setFeedback(
        result === 'inconcluso' || result === 'no_aplica'
          ? `${hypothesisId} · ${RESULT_LABEL[result]}: registrado; no cambia la probabilidad (no es evidencia concluyente). Guardado en el dispositivo.`
          : before != null && after
            ? `${hypothesisId} · ${RESULT_LABEL[result]}: en todas las celdas de tipo ${tipo?.nombre.toLowerCase()} la probabilidad de un resultado favorable pasó de ${pct(before)} a ${pct(betaMean(after))}. Guardado en el dispositivo.`
            : 'Observación guardada en el dispositivo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: stop.nombre.replace('PRUEBA – ', '') }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TestDataBanner />
        <Card>
          <Label>{stop.es_base ? 'Base' : `Terreno: ${tipo?.nombre ?? stop.tipo}`}</Label>
          <Body muted>
            Celda ({stop.fila}, {stop.col}) · {formatMars(coords)}
          </Body>
          <Body muted>{here ? '● Estás en esta parada' : 'No estás en esta parada'}</Body>
          {!here && stop.es_base && (
            <Button label="Llegué a la base" onPress={() => void markArrival(stop.id)} />
          )}
          {!here && (
            <Button
              label="Trazar ruta hasta aquí"
              outline
              onPress={() => {
                planRoute(stop.id);
                router.back();
              }}
            />
          )}
        </Card>

        {!stop.es_base && (
          <Card>
            <Label>Pregunta científica</Label>
            <Body>{stop.pregunta}</Body>
            <Label>Qué observar</Label>
            <Body>{stop.que_observar || '—'}</Body>
            <View style={styles.photo}>
              <Text style={styles.photoText}>{stop.foto ? 'Foto de referencia' : 'Foto real de Curiosity (pendiente)'}</Text>
            </View>
          </Card>
        )}

        {feedback && (
          <Card style={{ borderColor: colors.accent }}>
            <Body>{feedback}</Body>
          </Card>
        )}

        {stop.hipotesis.length > 0 && (
          <Card>
            <Label>Nota (opcional)</Label>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Qué viste, instrumento, calidad de la observación…"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.input}
            />
          </Card>
        )}

        {stop.hipotesis.map((hid) => {
          const h = dataset.hipotesis.find((x) => x.id === hid);
          const b = beliefs[beliefKey(hid, stop.tipo)];
          if (!h || !b) return null;
          const p = betaMean(b);
          const [lo, hi] = betaInterval95(b);
          const obs = observations.filter((o) => o.hypothesis_id === hid && o.terrain_type === stop.tipo);
          const n = (r: ObservationResult) => obs.filter((o) => o.result === r).length;
          const concluyentes = n('si') + n('no');
          const q = h.pregunta_id ? `${h.pregunta_id} · ` : '';
          return (
            <Card key={hid}>
              <Label>Respaldo observado — {q}{hid} · valor científico {h.valor_cientifico}</Label>
              <Body>{h.descripcion}</Body>
              {h.pregunta ? <Text style={styles.question}>{h.pregunta}</Text> : null}
              <View style={styles.probRow}>
                <Text style={styles.prob}>{pct(p)}</Text>
                <Text style={styles.probMeta}>
                  Probabilidad estimada de resultado favorable entre observaciones concluyentes · IC 95 % {pct(lo)}–{pct(hi)} · α={b.alpha} β={b.beta}
                </Text>
              </View>
              <ProbBar p={p} lo={lo} hi={hi} />
              <Text style={styles.probMeta}>
                {concluyentes === 0
                  ? 'Sin observaciones concluyentes en este tipo de terreno: se muestra el prior del prototipo.'
                  : `Sí ${n('si')} · No ${n('no')} · Inconcluso ${n('inconcluso')} · No aplica ${n('no_aplica')} (tipo ${tipo?.nombre.toLowerCase()})`}
              </Text>
              {h.criterios && (
                <View style={styles.criteria}>
                  {(['si', 'no', 'inconcluso', 'no_aplica'] as const).map((r) =>
                    h.criterios?.[r] ? (
                      <Text key={r} style={styles.criterion}>
                        <Text style={styles.criterionKey}>{RESULT_LABEL[r]}: </Text>
                        {h.criterios[r]}
                      </Text>
                    ) : null,
                  )}
                </View>
              )}
              <Text style={styles.ask}>Tu respuesta en esta parada:</Text>
              <View style={styles.buttons}>
                <Button label="Sí" color={colors.confirm} disabled={saving} onPress={() => record(hid, 'si')} style={styles.flex} />
                <Button label="No" color={colors.contradict} disabled={saving} onPress={() => record(hid, 'no')} style={styles.flex} />
              </View>
              <View style={styles.buttons}>
                <Button label="Inconcluso" color={colors.neutral} disabled={saving} onPress={() => record(hid, 'inconcluso')} style={styles.flex} />
                <Button label="No aplica" color={colors.neutral} outline disabled={saving} onPress={() => record(hid, 'no_aplica')} style={styles.flex} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, paddingBottom: 40 },
  photo: { height: 120, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed' },
  photoText: { color: colors.muted, fontSize: 12 },
  input: { minHeight: 60, color: colors.text, backgroundColor: colors.surface2, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
  probRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  prob: { color: colors.text, fontSize: 28, fontWeight: '800' },
  probMeta: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  ask: { color: colors.muted, fontSize: 13, marginTop: 4 },
  buttons: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, paddingHorizontal: 6 },
  question: { color: colors.text, fontSize: 15, fontWeight: '700' },
  criteria: { gap: 3, backgroundColor: colors.surface2, borderRadius: 8, padding: 8 },
  criterion: { color: colors.muted, fontSize: 12 },
  criterionKey: { color: colors.text, fontWeight: '700' },
});
