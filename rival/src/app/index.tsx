import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Asset } from 'expo-asset';
import { supabase } from '../lib/supabase';
import { RivalButton } from '../components/rival';
import { RivalColors, RivalType } from '../constants/rivalTheme';

const HERO_SOURCE = require('../../assets/images/backgrounds/optimized/a-small-group-of-diverse-athletes-2.jpg');
// RN Web's <Image> has no public resolveAssetSource (native-RN-only static) — see the
// same note in RivalFixedBackground.tsx. expo-asset's Asset.fromModule is the
// documented cross-platform way to turn a require()'d module id into a usable URI.
const HERO_URI = Platform.OS === 'web' ? Asset.fromModule(HERO_SOURCE).uri : undefined;

export default function WelcomeScreen() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home');
      }
    });
  }, []);

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        {/* Same web-only real-<img> escape hatch as RivalFixedBackground, and for the
            same reason: react-native-web's Image/ImageBackground hardcode
            backgroundPosition:'center' on the element that actually paints, so a
            focal point passed via style/imageStyle is silently ignored on web. This
            hero doesn't need one (centered is fine), but a plain <img> is also just
            the correct primitive for a normal block-flow photo — no position:fixed,
            no viewport math, it simply fills this relatively-positioned section. */}
        {Platform.OS === 'web' ? (
          // @ts-ignore — intentional escape hatch to a real DOM element.
          <img
            src={HERO_URI}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Image source={HERO_SOURCE} style={styles.heroImageNative} resizeMode="cover" />
        )}
        <View style={styles.scrim} />

        <SafeAreaView style={styles.content}>
          <Text style={styles.logo}>RIVAL</Text>

          <View style={styles.taglineWrap}>
            <Text style={styles.tagline}>Fitness is better shared</Text>
          </View>

          <View style={styles.buttons}>
            <RivalButton label="Get Started" onPress={() => router.push('/sign-up')} />
            <TouchableOpacity onPress={() => router.push('/sign-in')} style={styles.signInLink}>
              <Text style={styles.signInLinkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Plain block container — no flex:1 (that requires a height-bounded ancestor,
  // which this screen deliberately no longer has).
  page: {
    backgroundColor: RivalColors.surfaceLow,
  },
  // minHeight, not height: fills at least one screen but is free to grow, same as
  // any ordinary hero section on a real webpage.
  // 100dvh, not 100vh: on iOS 100vh is the LARGE viewport (741px of an 852px
  // iPhone 15 Pro screen) while only the SMALL viewport (659px) is actually
  // visible behind Safari's toolbar. Sizing the hero to 100vh pushed the
  // "Sign In" link into that hidden 82px band with nothing scrollable to
  // reach it. 100dvh tracks what is genuinely visible.
  hero: {
    position: 'relative',
    minHeight: '100dvh' as any,
    width: '100%',
  },
  heroImageNative: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(14,14,14,0.4)',
  },
  content: {
    minHeight: '100dvh' as any,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingTop: 24,
  },
  logo: {
    ...RivalType.titleMd,
    color: RivalColors.textPrimary,
    letterSpacing: 8,
    textAlign: 'center',
  },
  taglineWrap: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 32,
    marginTop: 80,
  },
  tagline: {
    ...RivalType.headlineLg,
    color: RivalColors.textPrimary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontSize: 17,
    lineHeight: 22,
  },
  buttons: {
    gap: 4,
    alignItems: 'center',
  },
  signInLink: {
    paddingVertical: 14,
  },
  signInLinkText: {
    color: RivalColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
