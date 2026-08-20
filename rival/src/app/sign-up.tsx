import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, Platform, Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Asset } from 'expo-asset';
import { supabase } from '../lib/supabase';
import { RivalButton, RivalIcon } from '../components/rival';
import { RivalColors, RivalRadius, RivalType } from '../constants/rivalTheme';

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignUp() {
    if (!displayName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace('/home');
  }

  // Same treatment as sign-in: react-native-web's ImageBackground paints its
  // image on an inner div that hardcodes centred positioning, so a focal point
  // passed via imageStyle is silently ignored. A real DOM <img> with
  // object-position behaves correctly; native falls back to <Image>.
  const bgUri = Platform.OS === 'web'
    ? Asset.fromModule(require('../../assets/images/backgrounds/optimized/a-small-group-of-diverse-athletes-2.jpg')).uri
    : undefined;

  return (
    <View style={styles.bg}>
      {Platform.OS === 'web' ? (
        // @ts-ignore — intentional escape hatch to a real DOM element; RN Web's renderer is react-dom
        <img
          src={bgUri}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% center', display: 'block' }}
        />
      ) : (
        <RNImage
          source={require('../../assets/images/backgrounds/optimized/a-small-group-of-diverse-athletes-2.jpg')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      <View style={styles.scrim} />

      <SafeAreaView style={styles.container}>
        <View style={styles.content}>

          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>RIVAL</Text>

          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join RIVAL and start competing</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="How friends will see you"
                placeholderTextColor={RivalColors.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={RivalColors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Min 6 characters"
                  placeholderTextColor={RivalColors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <RivalIcon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={RivalColors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <RivalButton
              label={loading ? 'Creating account...' : 'Create Account'}
              onPress={handleSignUp}
              disabled={loading}
              style={styles.submitBtn}
            />

            <TouchableOpacity onPress={() => router.push('/sign-in')}>
              <Text style={styles.link}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

// Deliberately mirrors sign-in.tsx. The two screens sit either side of one
// decision, and sign-up had never been brought onto Refined Ember — it was
// still flat #111111 with the pre-Ember magenta and lime, so creating an
// account looked like a different product from signing in to one.
const styles = StyleSheet.create({
  bg: {
    flex: 1,
    position: 'relative',
    backgroundColor: RivalColors.surfaceLowest,
  },
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(14,14,14,0.35)',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    top: 16,
    left: 24,
  },
  backText: {
    color: RivalColors.textPrimary,
    fontSize: 16,
  },
  logo: {
    ...RivalType.titleMd,
    color: RivalColors.textPrimary,
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(19,19,19,0.75)',
    borderRadius: RivalRadius.lg,
    padding: 24,
    gap: 16,
  },
  title: {
    ...RivalType.headlineLgMobile,
    color: RivalColors.textPrimary,
    textTransform: 'uppercase',
  },
  subtitle: {
    ...RivalType.bodyMd,
    color: RivalColors.textSecondary,
    marginTop: -8,
  },
  errorBox: {
    backgroundColor: RivalColors.errorContainer,
    borderRadius: RivalRadius.DEFAULT,
    padding: 12,
  },
  errorText: {
    color: RivalColors.error,
    fontSize: 14,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    ...RivalType.labelCaps,
    fontSize: 12,
    color: RivalColors.onSurfaceVariant,
  },
  input: {
    backgroundColor: RivalColors.surfaceBright,
    borderRadius: RivalRadius.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: RivalColors.textPrimary,
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RivalColors.surfaceBright,
    borderRadius: RivalRadius.DEFAULT,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: RivalColors.textPrimary,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  submitBtn: {
    marginTop: 8,
  },
  link: {
    color: RivalColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
