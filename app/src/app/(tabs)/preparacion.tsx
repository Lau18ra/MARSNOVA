// Developed with assistance from Claude (Anthropic); reviewed and validated by the MARSNOVA team.
/**
 * Preparación de la caminata: el astronauta indica su masa y lo que lleva; la app
 * calcula con el modelo de recursos del equipo la masa total, el peso en Marte,
 * la velocidad, la duración y los recursos al volver, y da un veredicto.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Chip, Label } from '@/components/ui';
import { SpaceWeatherBanner } from '@/components/SpaceWeather';
import { AstronautAvatar } from '@/components/AstronautAvatar';
import { makeStyles, useColors, type Colors } from '@/theme';
import { recursos, useEvaProfile, usePlanEva } from '@/store/evaProfile';
import { useSpaceWeather } from '@/services/useSpaceWeather';
import { dosisConAlerta, enDiasDeFondo, P_REF_PA } from '@/services/radiacion';
import type { Veredicto } from '@/model/eva';

const fmt = (n: number, d = 0) => n.toFixed(d).replace('.', ',');
const pctTxt = (f: number) => `${Math.round(f * 100)} %`;
const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;

const VEREDICTO: Record<Veredicto, { titulo: string; color: keyof Colors }> = {
  apto: { titulo: 'Apto para salir', color: 'ok' },
  precaucion: { titulo: 'Salir con precaución', color: 'confirm' },
  no_apto: { titulo: 'No salir', color: 'danger' },
};

function Stepper({ value, unit, onChange, steps = [-5, -1, 1, 5] }: { value: number; unit: string; onChange: (v: number) => void; steps?: number[] }) {
  const styles = useStyles();
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={styles.stepper}>
      {steps.filter((s) => s < 0).map((s) => (
        <Pressable key={s} style={styles.stepBtn} onPress={() => onChange(value + s)}>
          <Text style={styles.stepTxt}>{s}</Text>
        </Pressable>
      ))}
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={text ?? String(value)}
        onChangeText={setText}
        onEndEditing={() => {
          const v = Number((text ?? '').replace(',', '.'));
          if (text !== null && Number.isFinite(v)) onChange(v);
          setText(null);
        }}
      />
      <Text style={styles.unit}>{unit}</Text>
      {steps.filter((s) => s > 0).map((s) => (
        <Pressable key={s} style={styles.stepBtn} onPress={() => onChange(value + s)}>
          <Text style={styles.stepTxt}>+{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Bar({ label, frac, detalle, min }: { label: string; frac: number; detalle: string; min?: number }) {
  const styles = useStyles();
  const colors = useColors();
  const f = Math.max(0, Math.min(1, frac));
  const color = min != null && frac < min ? colors.danger : frac < 0.5 ? colors.confirm : colors.ok;
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barLabel, { color }]}>{pctTxt(frac)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${f * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.meta}>{detalle}</Text>
    </View>
  );
}

export default function PreparacionScreen() {
  const styles = useStyles();
  const colors = useColors();
  const s = useEvaProfile();
  const sw = useSpaceWeather();
  const plan = usePlanEva(sw.nivel);
  const v = VEREDICTO[plan.veredicto];
  const horas = plan.tiempoMisionMin / 60;
  const dosis = dosisConAlerta(P_REF_PA, horas, sw.nivel);
  const c = recursos.capacidad;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AstronautAvatar />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Astronauta</Text>
          <Text style={styles.meta}>
            {fmt(s.masaCorporalKg)} kg · {s.herramientas.length} {s.herramientas.length === 1 ? 'herramienta' : 'herramientas'}
          </Text>
          <View style={[styles.verdict, { borderColor: colors[v.color] }]}>
            <View style={[styles.verdictDot, { backgroundColor: colors[v.color] }]} />
            <Text style={[styles.verdictText, { color: colors[v.color] }]}>{v.titulo}</Text>
          </View>
        </View>
      </View>

      <Body muted>
        Antes de salir: indica tu masa y lo que llevas. MARSNOVA calcula tu velocidad, cuánto dura la caminata y con
        cuántos recursos vuelves a la base.
      </Body>

      <Card>
        <Label>Tu masa corporal</Label>
        <Stepper value={s.masaCorporalKg} unit="kg" onChange={s.setMasaCorporal} />
      </Card>

      <Card>
        <Label>Herramientas que llevas</Label>
        <View style={styles.chips}>
          {recursos.herramientas.map((h) => (
            <Chip
              key={h.id}
              label={`${h.nombre} · ${fmt(h.masa_kg, 1)} kg`}
              active={s.herramientas.includes(h.id)}
              onPress={() => s.toggleHerramienta(h.id)}
            />
          ))}
        </View>
        <Text style={[styles.meta, { marginTop: 8 }]}>Otra carga</Text>
        <Stepper value={s.cargaExtraKg} unit="kg" onChange={s.setCargaExtra} steps={[-5, -1, 1, 5]} />
        <Text style={styles.meta}>Masas de herramientas estimadas para el prototipo.</Text>
      </Card>

      <View style={styles.grid}>
        <Card style={styles.cell}>
          <Label>Masa total</Label>
          <Text style={styles.valueSm}>{fmt(plan.masaTotalKg)} kg</Text>
          <Text style={styles.meta}>
            Tú {fmt(s.masaCorporalKg)} + traje {recursos.masa_traje_kg} + carga {fmt(plan.masaHerramientasKg + s.cargaExtraKg, 1)}
          </Text>
        </Card>
        <Card style={styles.cell}>
          <Label>Peso en Marte</Label>
          <Text style={styles.valueSm}>{fmt(plan.pesoMarteN)} N</Text>
          <Text style={styles.meta}>Se siente como {fmt(plan.pesoEquivalenteTierraKgf)} kg en la Tierra (g = 3,72 m/s²)</Text>
        </Card>
        <Card style={styles.cell}>
          <Label>Velocidad</Label>
          <Text style={styles.valueSm}>{fmt(plan.velocidadKmh, 2)} km/h</Text>
          <Text style={styles.meta}>Según tu masa total</Text>
        </Card>
        <Card style={styles.cell}>
          <Label>Duración</Label>
          <Text style={styles.valueSm}>{hm(plan.tiempoMisionMin)}</Text>
          <Text style={styles.meta}>
            {fmt(plan.distanciaM / 1000, 2)} km · marcha {hm(plan.tiempoMarchaMin)} + paradas {fmt(plan.tiempoParadasMin)} min
          </Text>
        </Card>
      </View>

      <Card>
        <Label>Recursos al volver a la base</Label>
        <View style={{ gap: 12 }}>
          <Bar label="Oxígeno" frac={plan.restante.o2} min={recursos.limites.reserva_o2_minima}
            detalle={`Usa ${fmt(plan.consumo.o2_g)} g de ${c.o2_g} g · reserva de emergencia: ${c.o2_emergencia_min} min`} />
          <Bar label="Batería" frac={plan.restante.bateria} min={recursos.limites.bateria_minima}
            detalle={`Usa ${pctTxt(plan.consumo.bateria)} de la carga`} />
          <Bar label="Agua de refrigeración" frac={plan.restante.agua_refrigeracion}
            detalle={`Usa ${fmt(plan.consumo.agua_refrigeracion_l, 2)} L de ${c.agua_refrigeracion_l} L`} />
          <Bar label="Agua potable" frac={plan.restante.agua_potable_l / c.agua_potable_l}
            detalle={`Usa ${fmt(plan.consumo.agua_potable_l, 2)} L de ${c.agua_potable_l} L`} />
        </View>
      </Card>

      <Card>
        <Label>Radiación estimada en la caminata</Label>
        <Text style={styles.valueSm}>{fmt(dosis.total)} µGy</Text>
        <Text style={styles.meta}>
          Equivale a {fmt(enDiasDeFondo(dosis.total), 1)} días de fondo en Marte (Curiosity RAD, presión media anual).
        </Text>
      </Card>

      <SpaceWeatherBanner sw={sw} />

      <Card style={{ borderColor: colors[v.color] }}>
        <Label>Veredicto</Label>
        <Text style={[styles.value, { color: colors[v.color] }]}>{v.titulo}</Text>
        {plan.motivos.length ? (
          plan.motivos.map((m) => (
            <Text key={m} style={styles.meta}>
              • {m}
            </Text>
          ))
        ) : (
          <Text style={styles.meta}>
            Vuelves con más del {pctTxt(recursos.limites.reserva_o2_precaucion)} de oxígeno, la caminata dura menos de{' '}
            {recursos.limites.eva_max_h} h y nunca te alejas más de {fmt(recursos.ruta.distancia_max_base_m / 1000, 2)} km de la base.
          </Text>
        )}
      </Card>

      <Button
        label={plan.veredicto === 'no_apto' ? 'Ver el mapa igualmente' : 'Confirmar y ver el mapa'}
        color={plan.veredicto === 'no_apto' ? colors.danger : colors.accent}
        outline={plan.veredicto === 'no_apto'}
        onPress={() => {
          s.confirmar();
          router.navigate('/');
        }}
      />

      <Text style={styles.source}>
        Modelo de recursos del equipo (modelo/recursos_eva): se interpola entre dos perfiles de referencia de 130 y 145 kg
        con traje. Valores estimados, no especificaciones de un traje real: la velocidad y el consumo de oxígeno son coherentes con las
        caminatas Apollo (NASA TN D-7883; Lunar Surface Journal); el traje de 65 kg es más liviano que el máximo de 104 kg que NASA
        recomienda para Marte (ICES-2026-127). Límite de 8 h: NASA, Artemis EVA ConOps (2020).
        Ruta: base en P02, dos salidas por la ruta V2.
      </Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { padding: 14, gap: 10, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  headerText: { flex: 1, gap: 4 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, marginTop: 2 },
  verdictDot: { width: 8, height: 8, borderRadius: 4 },
  verdictText: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexBasis: '47%', flexGrow: 1 },
  value: { color: colors.text, fontSize: 24, fontWeight: '800' },
  valueSm: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12 },
  source: { color: colors.muted, fontSize: 11, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  stepBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface2 },
  stepTxt: { color: colors.text, fontWeight: '700' },
  input: { minWidth: 64, borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  unit: { color: colors.muted, fontSize: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
}));
