import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Manrope_300Light, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { registerForPushNotifications } from '../lib/notifications';

export default function RootLayout() {
  // Web loads Manrope via the CSS @import in global.css and renders fine
  // before this resolves; native needs the font registered before any Text
  // using it mounts, but we don't gate rendering on it — a brief native
  // fallback-font flash is an acceptable tradeoff against a blank splash.
  useFonts({ Manrope_300Light, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
