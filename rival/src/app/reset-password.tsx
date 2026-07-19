import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const [status, setStatus] = useState<'verifying' | 'ready' | 'invalid'>('verifying');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setStatus('invalid');
      return;
    }

    (async () => {
      // Supabase's recovery link appends tokens to the URL fragment (since we run with
      // detectSessionInUrl: false to avoid clashing with the Strava OAuth callback).
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        setStatus(error ? 'invalid' : 'ready');
        return;
      }

      // Fallback: PKCE-style `?code=` param.
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setStatus(error ? 'invalid' : 'ready');
        return;
      }

      setStatus('invalid');
    })();
  }, []);

  async function handleSetNewPassword() {
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace('/home');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>RIVAL</Text>

        {status === 'verifying' && (
          <Text style={styles.status}>Verifying your reset link…</Text>
        )}

        {status === 'invalid' && (
          <>
            <Text style={styles.status}>
              This reset link is invalid or has expired. Go back and request a new one.
            </Text>
            <TouchableOpacity onPress={() => router.replace('/sign-in')}>
              <Text style={styles.link}>← Back to sign in</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'ready' && (
          <View style={styles.form}>
            <Text style={styles.title}>Set a new password</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor="#6b7280"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor="#6b7280"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabled]}
              onPress={handleSetNewPassword}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Set New Password'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, paddingHorizontal: 24 },
  logo: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: 6 },
  status: { fontSize: 16, color: '#999999', textAlign: 'center', paddingHorizontal: 20 },
  link: { color: '#E91E8C', fontSize: 15, fontWeight: '600' },
  form: { width: '100%', maxWidth: 360, gap: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#dc2626' },
  errorText: { color: '#fca5a5', fontSize: 14 },
  inputGroup: { gap: 8 },
  label: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: '#111111', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#FFFFFF', fontSize: 16, borderWidth: 1, borderColor: '#8DC63F',
  },
  primaryButton: { backgroundColor: '#E91E8C', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
