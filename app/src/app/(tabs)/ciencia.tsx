import { ScrollView, Text, View } from 'react-native';
import { Body, Card, Label, ProbBar, TestDataBanner } from '@/components/ui';
import { dataset } from '@/data';
import { beliefKey, betaInterval95, betaMean, UPDATE_RULES } from '@/model/beta';
import { buildHistory } from '@/model/history';
import { getStop, useMission } from '@/store/missionStore';
import { makeStyles, pct, RESULT_LABEL, useColors } from '@/theme';

const typeName = (id: number) => dataset.tipos.tipos.find((t) => t.id === id)?.nombre ?? String(id);

export default function ScienceScreen() {
  const styles = useStyles();
  const colors = useColors();
  const beliefs = useMission((s) => s.beliefs);
  const observations = useMission((s) => s.observations);
  const history = buildHistory(dataset.hipotesis, observations).reverse();

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <TestDataBanner />
      <Body muted>
        Cada observación actualiza la probabilidad de la hipótesis en todo el tipo de terreno, no solo en la parada.
        Las probabilidades son creencias actualizadas, no certezas.
      </Body>

      {dataset.hipotesis.map((h) => (
        <Card key={h.id}>
          <Label>{h.id} · valor científico {h.valor_cientifico}</Label>
          <Body>{h.descripcion}</Body>
          {Object.keys(h.por_tipo).map((t) => {
            const b = beliefs[beliefKey(h.id, Number(t))];
            if (!b) return null;
            const prior = h.por_tipo[t];
            const p = betaMean(b);
            const [lo, hi] = betaInterval95(b);
            return (
              <View key={t} style={styles.typeRow}>
                <View style={styles.typeHead}>
                  <Text style={styles.typeName}>{typeName(Number(t))}</Text>
                  <Text style={styles.typeProb}>
                    {pct(betaMean(prior))} → <Text style={{ color: colors.text, fontWeight: '800' }}>{pct(p)}</Text>
                  </Text>
                </View>
                <ProbBar p={p} lo={lo} hi={hi} />
                <Text style={styles.small}>
                  IC 95 % {pct(lo)}–{pct(hi)} · α={b.alpha} β={b.beta}
                </Text>
              </View>
            );
          })}
        </Card>
      ))}

      <Card>
        <Label>Historial bayesiano</Label>
        {history.length === 0 && <Body muted>Aún no hay observaciones.</Body>}
        {history.map(({ item, antes, despues }) => {
          const up = despues > antes;
          return (
            <View key={item.uuid} style={styles.hist}>
              <Text style={styles.histTitle}>
                {item.hypothesis_id} · {typeName(item.terrain_type)} · {RESULT_LABEL[item.result]}
              </Text>
              <Text style={[styles.histDelta, { color: up ? colors.confirm : despues < antes ? colors.contradict : colors.muted }]}>
                {pct(antes)} → {pct(despues)}
              </Text>
              <Text style={styles.small}>
                {getStop(item.stop_id)?.nombre.replace('PRUEBA – ', '') ?? item.stop_id} ·{' '}
                {new Date(item.created_at).toLocaleTimeString()} · {item.sync_status}
                {item.note ? ` · “${item.note}”` : ''}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card>
        <Label>Reglas del modelo</Label>
        <Body muted>
          Beta(α, β) por hipótesis y tipo de terreno. Sí: α+{UPDATE_RULES.si.alpha}. No: β+{UPDATE_RULES.no.beta}.
          Inconcluso:{' '}
          {UPDATE_RULES.inconcluso.alpha === 0 && UPDATE_RULES.inconcluso.beta === 0
            ? 'no cambia nada (no aporta evidencia)'
            : `α+${UPDATE_RULES.inconcluso.alpha}, β+${UPDATE_RULES.inconcluso.beta}`}
          . No aplica: no cambia nada y se cuenta aparte. Probabilidad = α/(α+β): probabilidad estimada de un
          resultado favorable entre observaciones concluyentes, no prueba de la hipótesis.
          El intervalo es el creíble central al 95 % de la Beta, igual que en la validación en MATLAB.
        </Body>
      </Card>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { padding: 14, gap: 12, paddingBottom: 40 },
  typeRow: { gap: 4, marginTop: 6 },
  typeHead: { flexDirection: 'row', justifyContent: 'space-between' },
  typeName: { color: colors.text, fontWeight: '600' },
  typeProb: { color: colors.muted },
  small: { color: colors.muted, fontSize: 11 },
  hist: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 8, gap: 2 },
  histTitle: { color: colors.text, fontWeight: '600' },
  histDelta: { fontWeight: '800', fontSize: 15 },
}));
