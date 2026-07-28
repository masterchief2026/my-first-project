import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, Platform, Image as RNImage } from 'react-native';
import { Asset } from 'expo-asset';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { RivalButton } from '../components/rival';
import { RivalColors, RivalRadius, RivalType } from '../constants/rivalTheme';

const REMEMBER_KEY = 'rival_remembered_email';

function loadRemembered(): { email: string; remember: boolean } {
  if (Platform.OS === 'web') {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) return { email: saved, remember: true };
  }
  return { email: '', remember: false };
}

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const { email: savedEmail, remember } = loadRemembered();
    if (savedEmail) setEmail(savedEmail);
    setRememberMe(remember);
  }, []);

  async function resolveEmail(identifier: string): Promise<string | null> {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return identifier;
    const username = identifier.replace(/^@/, '');
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/resolve-login-identifier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! },
        body: JSON.stringify({ identifier: username }),
      });
      const data = await res.json();
      return data.email ?? null;
    } catch {
      return null;
    }
  }

  async function handleSignIn() {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const resolvedEmail = await resolveEmail(email.trim());
    if (!resolvedEmail) {
      setError('Invalid login credentials');
      setLoading(false);
      return;
    }

    if (Platform.OS === 'web') {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace('/home');
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email or username above first, then tap "Forgot password?"');
      return;
    }
    setResetLoading(true);
    setError('');
    const resolvedEmail = await resolveEmail(email.trim());
    const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/reset-password` : undefined;
    if (resolvedEmail) {
      await supabase.auth.resetPasswordForEmail(resolvedEmail, { redirectTo });
    }
    setResetLoading(false);
    setResetSent(true);
  }

  // react-native-web's ImageBackground renders its background-image on an
  // inner div that hardcodes centered positioning — the imageStyle/style prop
  // never reaches it, so a custom focal point is silently a no-op there. A
  // real DOM <img> with object-position behaves correctly instead.
  // react-native-web's <Image> has no public resolveAssetSource (that's a
  // native-RN-only static) — expo-asset's Asset.fromModule is the documented
  // cross-platform way to turn a require()'d module id into a usable URI.
  const bgUri = Platform.OS === 'web'
    ? Asset.fromModule(require('../../assets/images/backgrounds/optimized/2-3-trail-runners-moving-along-a.jpg')).uri
    : undefined;

  return (
    <View style={styles.bg}>
      {Platform.OS === 'web' ? (
        // @ts-ignore — intentional escape hatch to a real DOM element; RN Web's renderer is react-dom
        <img
          src={bgUri}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '62% center', display: 'block' }}
        />
      ) : (
        <RNImage
          source={require('../../assets/images/backgrounds/optimized/2-3-trail-runners-moving-along-a.jpg')}
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Your effort is waiting.</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {resetSent ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>
                  We've sent a password reset link to the supplied email of this account. Click it to set a new password.
                </Text>
                <TouchableOpacity onPress={() => setResetSent(false)}>
                  <Text style={styles.successDismiss}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email or Username</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com or @username"
                placeholderTextColor={RivalColors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Your password"
                  placeholderTextColor={RivalColors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rowBetween}>
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setError(''); setResetSent(false); handleForgotPassword(); }} disabled={resetLoading}>
                <Text style={styles.forgotLink}>{resetLoading ? 'Sending…' : 'Forgot password?'}</Text>
              </TouchableOpacity>
            </View>

            <RivalButton
              label={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleSignIn}
              disabled={loading}
              style={styles.signInBtn}
            />

            <TouchableOpacity onPress={() => router.push('/sign-up')}>
              <Text style={styles.link}>Don't have an account? Sign up</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    position: 'relative',
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
    letterSpacing: 2,
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
    paddingVertical: 14,
  },
  eyeText: {
    fontSize: 18,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotLink: {
    color: RivalColors.accentText,
    fontSize: 13,
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: RivalColors.tertiaryContainer,
    borderRadius: RivalRadius.DEFAULT,
    padding: 12,
  },
  successText: {
    flex: 1,
    color: RivalColors.onTertiaryContainer,
    fontSize: 13,
    lineHeight: 19,
  },
  successDismiss: {
    color: RivalColors.onTertiaryContainer,
    fontSize: 14,
    fontWeight: '700',
    paddingTop: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: RivalColors.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: RivalColors.accentFill,
  },
  checkmark: {
    color: RivalColors.onAccentFill,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  checkboxLabel: {
    color: RivalColors.textSecondary,
    fontSize: 14,
  },
  signInBtn: {
    marginTop: 8,
  },
  link: {
    color: RivalColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
