import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { RivalButton } from '../components/rival';
import { RivalColors, RivalType } from '../constants/rivalTheme';

export default function WelcomeScreen() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home');
      }
    });
  }, []);

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/optimized/a-small-group-of-diverse-athletes-2.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.scrim} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>

          <Text style={styles.logo}>RIVAL</Text>

          <View style={styles.hero}>
            {/* Tagline matches the locked Stitch mockup this photo came from —
                not a new copy decision, just carrying the pair through. */}
            <Text style={styles.tagline}>Fitness is better when it's shared</Text>
            <Text style={styles.sub}>
              Every workout earns Effort. Every week has a winner.
            </Text>
          </View>

          <View style={styles.buttons}>
            <RivalButton label="Get Started" onPress={() => router.push('/sign-up')} />
            <TouchableOpacity onPress={() => router.push('/sign-in')} style={styles.signInLink}>
              <Text style={styles.signInLinkText}>Sign In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  scrim: {
    position: 'absolute',
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
  sub: {
    ...RivalType.bodyMd,
    color: RivalColors.onSurfaceVariant,
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
