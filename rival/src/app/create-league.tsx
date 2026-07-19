import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, Switch, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function todayLocalStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type RaceOption = { id: string; name: string; race_date: string; race_type: string };

export default function CreateLeagueScreen() {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Journeys: a league becomes a shared destination when a race is attached — see
  // project_rival_journeys_concept.md. Deliberately optional, defaults to a normal league.
  const [myRaces, setMyRaces] = useState<RaceOption[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('races')
        .select('id, name, race_date, race_type')
        .eq('user_id', user.id)
        .gte('race_date', todayLocalStr())
        .order('race_date', { ascending: true });
      setMyRaces(data ?? []);
    })();
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Please enter a team name.');
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
        race_id: selectedRaceId,
      })
      .select('id')
      .maybeSingle();

    if (leagueError || !league) {
      console.log('League error:', JSON.stringify(leagueError));
      setError('Failed to create team. Please try again.');
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
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Create a Team</Text>
        <Text style={styles.subtitle}>Set up your team and invite your friends.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Team name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Monday Morning Team"
            placeholderTextColor="#666666"
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoFocus
          />

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Private team</Text>
              <Text style={styles.toggleSubtitle}>Invite only — members join with a code</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#111111', true: '#E91E8C' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {myRaces.length > 0 && (
            <View>
              <Text style={styles.label}>Make this a Journey (optional)</Text>
              <Text style={styles.toggleSubtitle}>Attach one of your races — everyone in this team trains toward it together, each with their own goal.</Text>
              <View style={styles.raceOptionRow}>
                <TouchableOpacity
                  style={[styles.raceOption, selectedRaceId === null && styles.raceOptionActive]}
                  onPress={() => setSelectedRaceId(null)}
                >
                  <Text style={[styles.raceOptionText, selectedRaceId === null && styles.raceOptionTextActive]}>Just a team</Text>
                </TouchableOpacity>
                {myRaces.map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.raceOption, selectedRaceId === r.id && styles.raceOptionActive]}
                    onPress={() => setSelectedRaceId(r.id)}
                  >
                    <Text style={[styles.raceOptionText, selectedRaceId === r.id && styles.raceOptionTextActive]}>{r.name}</Text>
                    <Text style={styles.raceOptionMeta}>{new Date(r.race_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Team'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 60,
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
  raceOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  raceOption: { backgroundColor: '#111111', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  raceOptionActive: { backgroundColor: '#1A0A12', borderColor: '#E91E8C' },
  raceOptionText: { color: '#CCCCCC', fontSize: 13, fontWeight: '700' },
  raceOptionTextActive: { color: '#E91E8C' },
  raceOptionMeta: { color: '#666666', fontSize: 11, marginTop: 2 },
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
