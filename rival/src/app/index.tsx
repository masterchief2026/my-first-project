import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { RivalButton, RivalFixedBackground } from '../components/rival';
import { RivalColors, RivalType } from '../constants/rivalTheme';

export default function WelcomeScreen() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home');
      }
    });
  }, []);

  // react-native-web locks the real <body> to overflow:hidden (it manages scrolling
  // itself, per-screen, via internal ScrollViews) — but that also stops iOS Safari
  // from ever seeing this outermost document as scrollable, so it keeps its fully
  // opaque toolbar permanently instead of the translucent/collapsed chrome it uses
  // on genuinely scrollable pages. This is the very first screen anyone sees, so:
  // temporarily let the real document scroll a hair and nudge it, then restore
  // react-native-web's normal behavior on the way out so every other screen's own
  // ScrollView-based scrolling is unaffected.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const html = document.documentElement;
    const { body } = document;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyMinHeight: body.style.minHeight,
      htmlOverscroll: (html.style as any).overscrollBehaviorY,
      bodyOverscroll: (body.style as any).overscrollBehaviorY,
    };
    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    body.style.minHeight = 'calc(100% + 1px)';
    // Without this, pulling down triggers the native rubber-band bounce, which
    // yanks the whole (fixed-position) page down and exposes empty space above the
    // background photo — worse than the bar we're trying to fix. We only need the
    // page to register as "scrollable" for Safari's chrome-collapse heuristic, not
    // to actually let anyone scroll or bounce it.
    (html.style as any).overscrollBehaviorY = 'none';
    (body.style as any).overscrollBehaviorY = 'none';
    window.scrollTo(0, 1);
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.minHeight = prev.bodyMinHeight;
      (html.style as any).overscrollBehaviorY = prev.htmlOverscroll;
      (body.style as any).overscrollBehaviorY = prev.bodyOverscroll;
    };
  }, []);

  return (
    <View style={styles.root}>
      <RivalFixedBackground
        source={require('../../assets/images/backgrounds/optimized/a-small-group-of-diverse-athletes-2.jpg')}
      />
      <View style={styles.scrim} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>

          <Text style={styles.logo}>RIVAL</Text>

          <View style={styles.hero}>
            <Text style={styles.tagline}>Fitness is better shared</Text>
          </View>

          <View style={styles.buttons}>
            <RivalButton label="Get Started" onPress={() => router.push('/sign-up')} />
            <TouchableOpacity onPress={() => router.push('/sign-in')} style={styles.signInLink}>
              <Text style={styles.signInLinkText}>Sign In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: RivalColors.surfaceLow,
  },
  scrim: {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(14,14,14,0.4)',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 32,
  },
  tagline: {
    ...RivalType.headlineLg,
    color: RivalColors.textPrimary,
    textAlign: 'center',
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
