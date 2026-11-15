import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { colors } from '@/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ color, fontSize: 18 }}>{glyph}</Text>
);

/** La app abre en Preparación: el astronauta revisa su perfil antes de ver el mapa. */
export const unstable_settings = { initialRouteName: 'preparacion' };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="preparacion" options={{ title: 'Preparación', tabBarIcon: icon('⚙') }} />
      <Tabs.Screen name="index" options={{ title: 'Mapa', headerShown: false, tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="ciencia" options={{ title: 'Ciencia', tabBarIcon: icon('◆') }} />
      <Tabs.Screen name="condiciones" options={{ title: 'Condiciones', tabBarIcon: icon('☀') }} />
      <Tabs.Screen name="mision" options={{ title: 'Misión', tabBarIcon: icon('▲') }} />
    </Tabs>
  );
}
