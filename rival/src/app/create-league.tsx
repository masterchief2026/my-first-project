import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CreateLeagueScreen() {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!name.trim()) {
      setError('Please enter a league name.');
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

    const inviteCode = generateInviteCode();

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: name.trim(),
        created_by: user.id,
        is_private: isPrivate,
        invite_code: inviteCode,
      })
      .select('id')
      .maybeSingle();

    if (leagueError || !league) {
      console.log('League error:', JSON.stringify(leagueError));
      setError('Failed to create league. Please try again.');
      setLoading(false);
      return;
    }

    // Add creator as first member and admin
    await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: user.id,
      role: 'admin',
    });

    setLoading(false);
    router.replace({ pathname: '/league', params: { id: league.id } });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Create a League</Text>
        <Text style={styles.subtitle}>Set up your league and invite your friends.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>League name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Monday Morning Crew"
            placeholderTextColor="#666666"
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoFocus
          />

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Private league</Text>
              <Text style={styles.toggleSubtitle}>Invite only — members join with a code</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#111111', true: '#E91E8C' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create League'}
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
    gap: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#8DC63F',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#999999',
    marginTop: 2,
  },
  error: {
    color: '#f87171',
    fontSize: 14,
    marginTop: 16,
  },
  createButton: {
    backgroundColor: '#E91E8C',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 48,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
