import { View } from 'react-native';
import { useColors, useScheme } from '@/theme';

/**
 * Avatar ilustrado de un astronauta (casco, visor y hombros del traje),
 * dibujado con vistas para no depender de imágenes ni de SVG.
 */
export function AstronautAvatar({ size = 88 }: { size?: number }) {
  const c = useColors();
  const scheme = useScheme();
  const suit = scheme === 'dark' ? '#E9E5DD' : '#FFFFFF';
  const suitShade = scheme === 'dark' ? '#C9C3B8' : '#E2DCD2';
  const s = (f: number) => Math.round(size * f);

  const helmet = s(0.58);
  const visorW = s(0.42);
  const visorH = s(0.3);
  const bodyW = s(0.84);
  const bodyH = s(0.4);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Avatar de astronauta"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.accentSoft,
        borderColor: c.accent,
        borderWidth: 2,
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      {/* Hombros y torso del traje */}
      <View
        style={{
          position: 'absolute',
          bottom: -s(0.04),
          width: bodyW,
          height: bodyH,
          borderTopLeftRadius: bodyW / 2,
          borderTopRightRadius: bodyW / 2,
          backgroundColor: suit,
          borderColor: suitShade,
          borderWidth: 1,
          alignItems: 'center',
        }}
      >
        {/* Parche de la misión en el pecho */}
        <View style={{ marginTop: s(0.16), width: s(0.12), height: s(0.08), borderRadius: 2, backgroundColor: c.mars }} />
      </View>

      {/* Anillo del cuello */}
      <View
        style={{
          position: 'absolute',
          top: s(0.6),
          width: s(0.38),
          height: s(0.08),
          borderRadius: s(0.04),
          backgroundColor: suitShade,
        }}
      />

      {/* Casco */}
      <View
        style={{
          position: 'absolute',
          top: s(0.1),
          width: helmet,
          height: helmet,
          borderRadius: helmet / 2,
          backgroundColor: suit,
          borderColor: suitShade,
          borderWidth: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Visor */}
        <View
          style={{
            width: visorW,
            height: visorH,
            borderRadius: visorH / 2,
            backgroundColor: '#1B2436',
            borderColor: '#C9A227',
            borderWidth: 1.5,
            overflow: 'hidden',
          }}
        >
          {/* Reflejo */}
          <View
            style={{
              position: 'absolute',
              top: s(0.04),
              left: s(0.06),
              width: s(0.12),
              height: s(0.06),
              borderRadius: s(0.03),
              backgroundColor: '#FFFFFF',
              opacity: 0.55,
              transform: [{ rotate: '-20deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: s(0.04),
              right: s(0.07),
              width: s(0.05),
              height: s(0.03),
              borderRadius: s(0.015),
              backgroundColor: c.accent,
              opacity: 0.7,
            }}
          />
        </View>
      </View>

      {/* Lámpara del casco */}
      <View
        style={{
          position: 'absolute',
          top: s(0.15),
          right: s(0.2),
          width: s(0.08),
          height: s(0.08),
          borderRadius: s(0.04),
          backgroundColor: c.confirm,
          borderColor: suitShade,
          borderWidth: 1,
        }}
      />
    </View>
  );
}
