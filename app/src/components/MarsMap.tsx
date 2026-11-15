import { useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { dataset } from '@/data';
import { buildMapHtml } from '@/map/mapHtml';
import { BASE_IMAGE } from '@/map/baseImage';
import { DEM_IMAGE } from '@/map/demImage';
import { fullRoute } from '@/model/routes';
import type { MapInit, MapMessage, MapState, WalkerState } from '@/map/bridge';
import { colors } from '@/theme';

// Los tipos de react-native-webview 14 declaran props `WebViewProps & undefined`
// (= never) con los tipos de React actuales; este alias solo corrige el tipado.
type WebViewHandle = { injectJavaScript: (script: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

type Props = { state: MapState; walker?: WalkerState | null; onStopPress: (id: string) => void };

export function MarsMap({ state, walker = null, onStopPress }: Props) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);

  const html = useMemo(() => {
    const init: MapInit = {
      ancho: dataset.tipos.ancho,
      alto: dataset.tipos.alto,
      tipos: dataset.tipos.celdas,
      costo: dataset.costo.celdas,
      prohibido: dataset.costo.prohibido,
      tiposDef: dataset.tipos.tipos,
      paradas: dataset.paradas.map(({ id, nombre, fila, col, es_base }) => ({ id, nombre, fila, col, es_base })),
      baseImage: BASE_IMAGE,
      demImage: DEM_IMAGE,
      aoi: dataset.tipos.aoi_celdas,
      fullRoute: fullRoute(dataset.paradas, dataset.costo, dataset.rutas)?.path,
    };
    return buildMapHtml(init);
  }, []);

  useEffect(() => {
    if (!ready) return;
    ref.current?.injectJavaScript(`window.marsUpdate && window.marsUpdate(${JSON.stringify(state)}); true;`);
  }, [ready, state]);

  useEffect(() => {
    if (!ready) return;
    ref.current?.injectJavaScript(`window.marsWalker && window.marsWalker(${JSON.stringify(walker)}); true;`);
  }, [ready, walker]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: MapMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'stopPress') onStopPress(msg.id);
    else if (msg.type === 'error') console.warn('[mapa]', msg.message);
  };

  return (
    <View style={styles.wrap}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        style={styles.web}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
});
