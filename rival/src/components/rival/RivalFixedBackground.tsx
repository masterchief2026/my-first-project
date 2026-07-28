import { Platform, StyleSheet, View, ImageBackground, ImageSourcePropType } from 'react-native';
import { Asset } from 'expo-asset';

// Full-bleed, viewport-pinned background photo with a real focal point.
//
// react-native-web's <Image>/<ImageBackground> renders the actual CSS
// background-image on an INNER div that hardcodes `backgroundPosition:
// 'center'` — the `style`/`imageStyle` prop you pass is applied to a
// different (outer) element and never reaches the div that paints the
// image. So `objectPosition`/`backgroundPosition` passed via imageStyle is
// silently a no-op there, no matter what value you give it (verified via
// devtools: the rendered element only ever carries the library's own
// center-center rule). On web we sidestep this entirely with a plain DOM
// <img> + object-position, which behaves correctly. Native falls back to
// ImageBackground (this component is only ever used inside `position:
// 'fixed'` full-screen layouts, which are web-only anyway).
export function RivalFixedBackground({
  source,
  focalPoint = '50% 50%',
}: {
  source: ImageSourcePropType;
  focalPoint?: string;
}) {
  if (Platform.OS === 'web') {
    // react-native-web's <Image> has no public resolveAssetSource (that's a
    // native-RN-only static) — expo-asset's Asset.fromModule is the
    // documented cross-platform way to turn a require()'d module id into a
    // usable URI.
    const uri = typeof source === 'number'
      ? Asset.fromModule(source).uri
      : (source as { uri?: string })?.uri;
    return (
      <View style={styles.bgFixed}>
        {/* @ts-ignore — intentional escape hatch to a real DOM element; RN Web's renderer is react-dom */}
        <img
          src={uri}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focalPoint, display: 'block' }}
        />
      </View>
    );
  }
  return <ImageBackground source={source} style={styles.bgNative} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  // iOS Safari has TWO viewport heights: the "small" one (the strip between the
  // status bar and the bottom toolbar) and the "large" one (the whole screen, as if
  // the toolbars weren't there). Expo's own reset sets `html,body,#root{height:100%}`,
  // and a percentage/inset-based height resolves against the SMALL viewport — so a
  // full-bleed photo stops dead at the toolbars and reads as a hard grey box top and
  // bottom. `100vh` is the LARGE viewport: the usual "100vh is too tall on iOS"
  // complaint is exactly the behaviour wanted here, letting the photo run edge to
  // edge *behind* Safari's translucent chrome the way other sites do.
  // `bottom` is deliberately omitted — height governs instead.
  bgFixed: { position: 'fixed' as any, top: 0, left: 0, right: 0, width: '100%', height: '100vh' as any },
  // Native has no browser chrome and no vh units — plain full-bleed insets.
  bgNative: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
