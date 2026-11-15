import { Text, View } from 'react-native';
import { makeStyles } from '@/theme';

/** Barras simples por hora (0–23 h), con la ventana de caminata resaltada. */
export function HourlyBars({
  values, color, highlight, format = (v) => v.toFixed(0), height = 70,
}: {
  values: number[];
  color: string;
  highlight?: [number, number] | null;
  format?: (v: number) => string;
  height?: number;
}) {
  const styles = useStyles();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (
    <View>
      <View style={[styles.row, { height }]}>
        {values.map((v, h) => {
          const inWin = highlight ? h >= highlight[0] && h < highlight[1] : false;
          return (
            <View key={h} style={[styles.col, inWin && styles.win]}>
              <View style={{ height: 4 + ((v - min) / span) * (height - 8), backgroundColor: color, opacity: inWin || !highlight ? 1 : 0.45, borderRadius: 2 }} />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {[0, 6, 12, 18, 23].map((h) => (
          <Text key={h} style={styles.tick}>{h} h</Text>
        ))}
      </View>
      <Text style={styles.range}>mín. {format(min)} · máx. {format(max)}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  col: { flex: 1, justifyContent: 'flex-end', height: '100%', borderRadius: 3 },
  win: { backgroundColor: colors.accentSoft },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tick: { color: colors.muted, fontSize: 10 },
  range: { color: colors.muted, fontSize: 11, marginTop: 2 },
}));
