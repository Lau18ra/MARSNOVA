import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useNetworkState } from 'expo-network';
import { useMission } from '@/store/missionStore';
import { palettes, useScheme } from '@/theme';

function useConnectivity() {
  const net = useNetworkState();
  const setNetworkOnline = useMission((s) => s.setNetworkOnline);
  useEffect(() => {
    // Si el sistema aún no sabe (undefined/null), asumimos conectado; la
    // desconexión de la demo se controla con "Simular desconexión".
    setNetworkOnline(net.isConnected !== false && net.isInternetReachable !== false);
  }, [net.isConnected, net.isInternetReachable, setNetworkOnline]);
}

export default function RootLayout() {
  const ready = useMission((s) => s.ready);
  const init = useMission((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  useConnectivity();

  const scheme = useScheme();
  const colors = palettes[scheme];
  const theme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
    };
  }, [scheme, colors]);

  // Fondo de la vista raíz (visible durante transiciones y al abrir el teclado).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {!ready ? (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="parada/[id]" options={{ title: 'Parada' }} />
        </Stack>
      )}
    </ThemeProvider>
  );
}
