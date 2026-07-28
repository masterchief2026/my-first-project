import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function JoinLeagueScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    if (code.trim().length < 4) {
      setError('Please enter a valid invite code.');
      return;
    }

    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not logged in.');
      setLoading(false);
      return;
    }

    // Validate the code AND join in one server-side step (SECURITY DEFINER
    // RPC — supabase/join_league_with_code.sql). The code is the credential:
    // this works on public teams too, and upgrades a pending join-request to
    // active. A client-side insert can't do either without loosening RLS.
    const { data: result, error: joinError } = await supabase
      .rpc('join_league_with_code', { code: code.trim().toUpperCase() });

    if (joinError || !result || result.error) {
      console.log('Join error:', JSON.stringify(joinError ?? result?.error));
      setError(
        result?.error === 'invalid_code'
          ? 'Invalid invite code. Please check and try again.'
          : 'Failed to join team. Please try again.'
      );
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace({ pathname: '/league', params: { id: result.league_id } });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Join a Team</Text>
        <Text style={styles.subtitle}>Enter the invite code your friend shared with you.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. UXXOKL"
            placeholderTextColor="#666666"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.joinButton, loading && styles.joinButtonDisabled]}
          onPress={handleJoin}
          disabled={loading}
        >
          <Text style={styles.joinButtonText}>
            {loading ? 'Joining...' : 'Join Team'}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    marginBottom: 32,
  },
  back: {
    color: '#E91E8C',
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    marginBottom: 40,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#8DC63F',
    letterSpacing: 6,
    textAlign: 'center',
  },
  error: {
    color: '#f87171',
    fontSize: 14,
    marginTop: 16,
  },
  joinButton: {
    backgroundColor: '#E91E8C',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 48,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
