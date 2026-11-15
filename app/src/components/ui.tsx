import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { dataNotice, isTestData } from '@/data';
import { isOnline, useMission } from '@/store/missionStore';
import { makeStyles, useColors } from '@/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  return <Text style={[styles.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function Button({
  label, onPress, color, outline, disabled, style,
}: {
  label: string; onPress: () => void; color?: string; outline?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const colors = useColors();
  color ??= colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        outline ? { borderColor: color, borderWidth: 1.5 } : { backgroundColor: color },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.75 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: outline ? color : colors.onColor }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
      <Text style={[styles.chipText, active && { color: colors.onColor }]}>{label}</Text>
    </Pressable>
  );
}

/** Barra de probabilidad con su intervalo de incertidumbre. */
export function ProbBar({ p, lo, hi }: { p: number; lo: number; hi: number }) {
  const styles = useStyles();
  const colors = useColors();
  const c = p >= 0.5 ? colors.confirm : colors.contradict;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barRange, { left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }]} />
      <View style={[styles.barMark, { left: `${p * 100}%`, backgroundColor: c }]} />
      <View style={[styles.barHalf]} />
    </View>
  );
}

export function ConnectionBadge() {
  const styles = useStyles();
  const colors = useColors();
  const online = useMission(isOnline);
  const pending = useMission((s) => s.pending);
  return (
    <View style={[styles.badge, { borderColor: online ? colors.ok : colors.danger }]}>
      <View style={[styles.dot, { backgroundColor: online ? colors.ok : colors.danger }]} />
      <Text style={styles.badgeText}>
        {online ? 'Enlace con la Tierra' : 'Sin conexión'}
        {pending > 0 ? ` · ${pending} pendientes` : ''}
      </Text>
    </View>
  );
}

export function TestDataBanner() {
  const styles = useStyles();
  if (!isTestData) return null;
  return (
    <View style={styles.test}>
      <Text style={styles.testText}>{dataNotice}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '700', fontSize: 15 },
  chip: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden', justifyContent: 'center' },
  barRange: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.range },
  barMark: { position: 'absolute', width: 4, top: -2, bottom: -2, marginLeft: -2, borderRadius: 2 },
  barHalf: { position: 'absolute', left: '50%', width: 1, top: 0, bottom: 0, backgroundColor: colors.muted, opacity: 0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.overlay, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  test: { backgroundColor: colors.warnBg, borderColor: colors.warnBorder, borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start' },
  testText: { color: colors.warnText, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
}));
