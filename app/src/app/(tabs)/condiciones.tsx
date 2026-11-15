import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Body, Card, Chip, Label } from '@/components/ui';
import { HourlyBars } from '@/components/HourlyBars';
import { climatologia, dailyCycle } from '@/data/climatologia';
import { DEFAULT_EVA, findEvaWindow } from '@/model/evaWindow';
import { RadiationCard, SpaceWeatherBanner } from '@/components/SpaceWeather';
import { useSpaceWeather } from '@/services/useSpaceWeather';
import { useEvaProfile, usePlanEva } from '@/store/evaProfile';
import type { NivelAlerta } from '@/services/donki';
import { climate, LS_BINS, monthFor, seasonSouth } from '@/data/escenarios';
import { makeStyles, useColors, type Colors } from '@/theme';

const SCENARIO_LABEL: Record<string, string> = {
  cold: 'Frío (poco polvo)',
  warm: 'Cálido (mucho polvo)',
  strm: 'Tormenta',
};

const fmt = (n: number, d = 0) => n.toFixed(d).replace('.', ',');
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
/** Duración supuesta si no hay ventana recomendada ese día (h). */
const DEFAULT_EVA_HORAS = 4;

function dustLevel(tau: number, colors: Colors): { label: string; color: string } {
  if (tau >= 2) return { label: 'Tormenta de polvo: visibilidad y energía solar muy reducidas', color: colors.danger };
  if (tau >= 1) return { label: 'Polvo alto: menos luz y visibilidad', color: colors.confirm };
  if (tau >= 0.5) return { label: 'Polvo moderado', color: colors.confirm };
  return { label: 'Cielo despejado', color: colors.ok };
}

export default function ConditionsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const ids = [...climate.anios, ...climate.rango];
  const [mode, setMode] = useState<'promedio' | 'escenarios'>('promedio');
  const [scenario, setScenario] = useState(ids[0]);
  const [ls, setLs] = useState(0);

  const m = monthFor(scenario, ls);
  const cold = monthFor(climate.rango[0], ls);
  const warm = monthFor(climate.rango[1], ls);
  const storm = monthFor(climate.alerta, ls);
  const sw = useSpaceWeather();

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Body muted>{climate.sitio}</Body>

      <SpaceWeatherBanner sw={sw} />

      <View style={styles.chips}>
        <Chip label="Promedio hora a hora" active={mode === 'promedio'} onPress={() => setMode('promedio')} />
        <Chip label="Escenarios" active={mode === 'escenarios'} onPress={() => setMode('escenarios')} />
      </View>

      <Label>Época del año (Ls)</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {LS_BINS.map(([a, b]) => (
          <Chip key={a} label={`${a}–${b}°`} active={a === ls} onPress={() => setLs(a)} />
        ))}
      </ScrollView>
      <Body muted>Ls {ls}–{ls + 30}° · {seasonSouth(ls)}</Body>

      {mode === 'promedio' ? (
        <AverageDay ls={ls} nivel={sw.nivel} />
      ) : (
      <>
      <Label>Escenario</Label>
      <View style={styles.chips}>
        {ids.map((id) => (
          <Chip key={id} label={SCENARIO_LABEL[id] ?? id} active={id === scenario} onPress={() => setScenario(id)} />
        ))}
      </View>
      <Body muted>{climate.escenarios[scenario]?.descripcion}</Body>

      {storm && (
        <Card style={{ borderColor: colors.danger }}>
          <Label>Alerta · si hay tormenta de polvo en esta época</Label>
          <Body>
            Opacidad τ hasta {fmt(storm.tau_max, 1)}, luz solar máx. {storm.sol_max_wm2} W/m², superficie entre{' '}
            {fmt(storm.tsurf_min_c)} y {fmt(storm.tsurf_max_c)} °C.
          </Body>
        </Card>
      )}

      {!m ? (
        <Card>
          <Body muted>Este escenario no tiene datos para Ls {ls}–{ls + 30}°.</Body>
        </Card>
      ) : (
        <>
          <Card>
            <Label>Temperatura de la superficie</Label>
            <Text style={styles.value}>
              {fmt(m.tsurf_min_c)} a {fmt(m.tsurf_max_c)} °C
            </Text>
            <Text style={styles.meta}>Máxima hacia las {fmt(m.hora_tsurf_max, 1)} h (hora solar local; la MCD tiene un dato cada 2 h)</Text>
            {cold && warm && (
              <Text style={styles.meta}>
                Rango entre escenarios: mínimas {fmt(Math.min(cold.tsurf_min_c, warm.tsurf_min_c))} a{' '}
                {fmt(Math.max(cold.tsurf_min_c, warm.tsurf_min_c))} °C · máximas{' '}
                {fmt(Math.min(cold.tsurf_max_c, warm.tsurf_max_c))} a {fmt(Math.max(cold.tsurf_max_c, warm.tsurf_max_c))} °C
              </Text>
            )}
          </Card>

          <Card>
            <Label>Temperatura del aire</Label>
            <Text style={styles.value}>
              {fmt(m.taire_min_c)} a {fmt(m.taire_max_c)} °C
            </Text>
          </Card>

          <Card>
            <Label>Polvo (opacidad τ)</Label>
            <Text style={styles.value}>
              {fmt(m.tau_media, 2)} <Text style={styles.small}>media · máx. {fmt(m.tau_max, 2)}</Text>
            </Text>
            <Text style={[styles.meta, { color: dustLevel(m.tau_max, colors).color }]}>{dustLevel(m.tau_max, colors).label}</Text>
          </Card>

          <View style={styles.grid}>
            <Card style={styles.cell}>
              <Label>Presión</Label>
              <Text style={styles.valueSm}>
                {m.ps_min_pa}–{m.ps_max_pa} Pa
              </Text>
            </Card>
            <Card style={styles.cell}>
              <Label>Viento máx.</Label>
              <Text style={styles.valueSm}>{fmt(m.viento_max_ms, 1)} m/s</Text>
            </Card>
            <Card style={styles.cell}>
              <Label>Luz solar máx.</Label>
              <Text style={styles.valueSm}>{m.sol_max_wm2} W/m²</Text>
            </Card>
            <Card style={styles.cell}>
              <Label>Horas de luz</Label>
              <Text style={styles.valueSm}>≈ {m.horas_luz} h</Text>
            </Card>
          </View>
        </>
      )}

      <Text style={styles.source}>
        Fuente: {climate.fuente}. Valores de modelo (no mediciones) para el centro de la zona.
      </Text>
      </>
      )}

      <Card>
        <Label>Escarcha de CO₂</Label>
        <Body>No se forma en la zona según la MCD (hielo de CO₂ en superficie = 0 en todos los escenarios y épocas).</Body>
      </Card>

    </ScrollView>
  );
}

function AverageDay({ ls, nivel }: { ls: number; nivel: NivelAlerta }) {
  const styles = useStyles();
  const colors = useColors();
  const temp = dailyCycle('taire_c', ls);
  const tsurf = dailyCycle('tsurf_c', ls);
  const confirmado = useEvaProfile((s) => s.confirmado);
  const plan = usePlanEva(nivel);
  /** Si el astronauta confirmó su perfil, la dosis usa la duración real de su caminata. */
  const horasCaminata = confirmado ? plan.tiempoMisionMin / 60 : null;
  const wind = dailyCycle('viento_ms', ls);
  const ps = dailyCycle('ps_pa', ls);
  const clouds = dailyCycle('nubes_hielo_kgm2', ls);
  const solSup = dailyCycle('sol_superficie_wm2', ls);
  const solToa = dailyCycle('sol_toa_wm2', ls);
  const tauDust = dailyCycle('tau_polvo', ls);
  const dist = dailyCycle('distancia_sol_ua', ls);
  if (!temp || !wind) return <Body muted>Sin datos de la climatología para esta época.</Body>;
  const horas = climatologia.horas;
  const luz = solSup ? solSup.map((v) => v > 0) : undefined;
  const win = findEvaWindow(horas, wind, temp, DEFAULT_EVA, luz);
  const dayHours = luz ? horas.filter((_, i) => luz[i]) : [];
  const sunrise = dayHours.length ? dayHours[0] : null;
  const sunset = dayHours.length ? dayHours[dayHours.length - 1] + 1 : null;
  const noon = horas.indexOf(12);
  const solMax = solSup ? Math.max(...solSup) : null;
  const transmission = solSup && solToa && solToa[noon] > 0 ? solSup[noon] / solToa[noon] : null;
  const tauMean = tauDust ? tauDust.reduce((a, b) => a + b, 0) / tauDust.length : null;
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const cloudMax = clouds ? Math.max(...clouds) : 0;
  const cloudHour = clouds ? clouds.indexOf(cloudMax) : 0;

  return (
    <>
      <Card style={{ borderColor: colors.accent }}>
        <Label>Ventana recomendada para caminar</Label>
        {win ? (
          <>
            <Text style={styles.value}>
              {hh(win.inicio)} – {hh(win.fin)}
            </Text>
            <Text style={styles.meta}>
              {win.horas} h · aire entre {fmt(win.tMin)} y {fmt(win.tMax)} °C · viento hasta {fmt(win.vientoMaxEnVentana, 1)} m/s
            </Text>
          </>
        ) : (
          <Body>Ninguna hora de luz con viento por debajo de {DEFAULT_EVA.vientoMax} m/s en un día promedio.</Body>
        )}
        <Text style={styles.meta}>
          Criterio: horas con luz solar{sunrise != null ? ` (${hh(sunrise)}–${hh(sunset!)})` : ''} y viento ≤ {DEFAULT_EVA.vientoMax} m/s; se toma el bloque continuo más largo.
        </Text>
      </Card>

      {solSup && (
        <Card>
          <Label>Luz solar en la superficie (W/m²)</Label>
          <HourlyBars values={solSup} color="#F5C26B" highlight={win ? [win.inicio, win.fin] : null} format={(v) => `${fmt(v)} W/m²`} />
          <Text style={styles.meta}>
            {sunrise != null ? `Luz de ${hh(sunrise)} a ${hh(sunset!)}` : ''}
            {solMax != null ? ` · máx. ${fmt(solMax)} W/m² a mediodía` : ''}
            {transmission != null ? ` · llega el ${Math.round(transmission * 100)} % de la luz del tope de la atmósfera` : ''}
          </Text>
        </Card>
      )}

      {(tauMean != null || dist) && (
        <View style={styles.grid}>
          {tauMean != null && (
            <Card style={styles.cell}>
              <Label>Polvo (τ visible)</Label>
              <Text style={styles.valueSm}>{fmt(tauMean, 2)}</Text>
              <Text style={[styles.meta, { color: dustLevel(tauMean, colors).color }]}>{dustLevel(tauMean, colors).label}</Text>
            </Card>
          )}
          {dist && (
            <Card style={styles.cell}>
              <Label>Distancia al Sol</Label>
              <Text style={styles.valueSm}>{fmt(dist[0], 2)} UA</Text>
              <Text style={styles.meta}>{dist[0] < 1.45 ? 'cerca del perihelio' : dist[0] > 1.6 ? 'cerca del afelio' : 'distancia intermedia'}</Text>
            </Card>
          )}
        </View>
      )}

      {tsurf && (
        <Card>
          <Label>Temperatura de la superficie (°C)</Label>
          <HourlyBars values={tsurf} color={colors.mars} highlight={win ? [win.inicio, win.fin] : null} format={(v) => `${fmt(v)} °C`} />
          <Text style={styles.meta}>
            Entre {fmt(Math.min(...tsurf))} y {fmt(Math.max(...tsurf))} °C · es la del suelo que pisa el traje, no la del aire.
          </Text>
        </Card>
      )}

      <Card>
        <Label>Temperatura del aire a 2 m (°C)</Label>
        <HourlyBars values={temp} color={colors.confirm} highlight={win ? [win.inicio, win.fin] : null} format={(v) => `${fmt(v)} °C`} />
      </Card>

      <Card>
        <Label>Viento (m/s)</Label>
        <HourlyBars values={wind} color={colors.contradict} highlight={win ? [win.inicio, win.fin] : null} format={(v) => `${fmt(v, 1)} m/s`} />
      </Card>

      {ps && (
        <Card>
          <Label>Presión en superficie</Label>
          <Text style={styles.valueSm}>
            {fmt(Math.min(...ps))}–{fmt(Math.max(...ps))} Pa
          </Text>
        </Card>
      )}

      {ps && (
        <RadiationCard
          presionPa={mean(win ? ps.slice(win.inicio, win.fin) : ps)}
          horas={horasCaminata ?? (win ? win.horas : DEFAULT_EVA_HORAS)}
          nivel={nivel}
        />
      )}

      {clouds && (
        <Card>
          <Label>Nubes de hielo de agua</Label>
          <Body>
            {cloudMax > 5e-4
              ? `Hay nubes de hielo, más densas hacia las ${hh(cloudHour)}. Es hielo en la atmósfera, no escarcha en el suelo.`
              : 'Casi sin nubes de hielo en esta época.'}
          </Body>
        </Card>
      )}

      <Text style={styles.source}>
        Fuente: {climatologia.fuente} ({climatologia.escenario}), a 2 m del suelo, un dato por hora. Valores de modelo, no mediciones.
      </Text>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { padding: 14, gap: 10, paddingBottom: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipsRow: { flexDirection: 'row', gap: 6, paddingRight: 14 },
  value: { color: colors.text, fontSize: 24, fontWeight: '800' },
  valueSm: { color: colors.text, fontSize: 17, fontWeight: '800' },
  small: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  meta: { color: colors.muted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexBasis: '47%', flexGrow: 1 },
  source: { color: colors.muted, fontSize: 11, marginTop: 4 },
}));
