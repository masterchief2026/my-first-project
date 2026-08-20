import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppFonts } from '../lib/useAppFonts';
import { registerForPushNotifications } from '../lib/notifications';

export default function RootLayout() {
  // Native registers Manrope from bundled .ttf files; web is a no-op because
  // global.css already loads the family from Google Fonts. See useAppFonts.ts —
  // the platform split keeps ~570KB of duplicate .ttf out of the web bundle.
  // Rendering is deliberately not gated on this: a brief native fallback-font
  // flash beats a blank splash.
  useAppFonts();

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  // iOS standalone (home-screen) web apps have a documented bug: the page's
  // layout viewport (what 100vh/100dvh and position:fixed measure against)
  // can be reported taller than what's actually visible on screen — a fixed
  // bottom nav then pins correctly to the bottom of that oversized virtual
  // page, landing below the real visible area, with dead space in between
  // that no amount of scrolling reveals. window.visualViewport reports the
  // TRUE visible height, so measure that and clamp the whole app to it
  // instead of trusting vh units/fixed positioning to get it right alone.
  const [viewportHeight, setViewportHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  // SafeAreaProvider is what supplies the real device insets (notch, status bar, home
  // indicator) to every SafeAreaView in the app. Without it they silently report zero,
  // which is why content couldn't be inset independently of the full-bleed backgrounds.
  // On web it reads the CSS env(safe-area-inset-*) values, which only resolve because
  // the viewport meta in +html.tsx sets viewport-fit=cover.
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={Platform.OS === 'web' ? { height: viewportHeight ?? '100dvh', overflow: 'hidden' } as any : { flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </SafeAreaProvider>
  );
}
