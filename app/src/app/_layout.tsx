import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useNetworkState } from 'expo-network';
import { useMission } from '@/store/missionStore';
import { colors } from '@/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
};

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

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
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
