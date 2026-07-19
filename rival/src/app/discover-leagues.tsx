import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ScrollView, TextInput, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { RivalTopNav } from '../components/rival';

type MembershipState = 'none' | 'pending' | 'active';

type PublicLeague = {
  id: string;
  name: string;
  logo_url: string | null;
  member_count: number;
  membership: MembershipState;
};

export default function DiscoverLeaguesScreen() {
  const [leagues, setLeagues] = useState<PublicLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: allLeagues } = await supabase
      .from('leagues')
      .select('id, name, logo_url')
      .eq('is_private', false)
      .order('name');

    const { data: myMemberships } = await supabase
      .from('league_members')
      .select('league_id, status')
      .eq('user_id', user.id);

    const myMembershipMap = new Map((myMemberships || []).map((m: any) => [m.league_id, m.status as MembershipState]));

    // Only active members count toward the visible member count — a pending
    // request isn't a real member of the team yet.
    const { data: memberCounts } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('status', 'active');

    const countMap: Record<string, number> = {};
    (memberCounts || []).forEach((m: any) => {
      countMap[m.league_id] = (countMap[m.league_id] || 0) + 1;
    });

    setLeagues((allLeagues || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      logo_url: l.logo_url,
      member_count: countMap[l.id] || 0,
      membership: myMembershipMap.get(l.id) || 'none',
    })));
    setLoading(false);
  }

  async function join(leagueId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setJoining(leagueId);
    const { error } = await supabase.from('league_members').insert({ league_id: leagueId, user_id: user.id, role: 'member', status: 'pending' });
    setJoining(null);
    if (error) {
      Alert.alert('Could not send request', error.message);
      return;
    }
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, membership: 'pending' } : l));
  }

  const filtered = leagues.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      <RivalTopNav active="teams" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Discover Teams</Text>
        <Text style={styles.subtitle}>Request to join a public team and compete with new rivals.</Text>

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search teams…"
          placeholderTextColor="#555"
        />

        {loading && <Text style={styles.loading}>Loading…</Text>}

        {!loading && filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏟️</Text>
            <Text style={styles.emptyText}>No public teams found.</Text>
            <Text style={styles.emptySub}>Create one and make it public from Settings.</Text>
          </View>
        )}

        {filtered.map(league => (
          <View key={league.id} style={styles.leagueCard}>
            <View style={styles.leagueLeft}>
              {league.logo_url ? (
                <Image source={{ uri: league.logo_url }} style={styles.leagueLogo} />
              ) : (
                <View style={styles.leagueLogoFallback}><Text style={styles.leagueLogoFallbackText}>🏟️</Text></View>
              )}
              <View>
                <Text style={styles.leagueName}>{league.name}</Text>
                <Text style={styles.leagueMeta}>{league.member_count} {league.member_count === 1 ? 'member' : 'members'}</Text>
              </View>
            </View>
            {league.membership === 'active' ? (
              <TouchableOpacity onPress={() => router.push({ pathname: '/league', params: { id: league.id } })}>
                <Text style={styles.viewBtn}>View →</Text>
              </TouchableOpacity>
            ) : league.membership === 'pending' ? (
              <View style={styles.pendingPill}>
                <Text style={styles.pendingPillText}>Requested</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.joinBtn, joining === league.id && styles.joinBtnDisabled]}
                onPress={() => join(league.id)}
                disabled={joining === league.id}
              >
                <Text style={styles.joinBtnText}>{joining === league.id ? 'Sending…' : 'Request to join'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  back: { color: '#E91E8C', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#999999', marginBottom: 20 },
  search: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20 },
  loading: { color: '#999999', textAlign: 'center', marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  emptySub: { fontSize: 13, color: '#666666', textAlign: 'center' },
  leagueCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  leagueLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  leagueLogo: { width: 44, height: 44, borderRadius: 10 },
  leagueLogoFallback: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  leagueLogoFallbackText: { fontSize: 22 },
  leagueName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  leagueMeta: { fontSize: 12, color: '#999999', marginTop: 2 },
  viewBtn: { color: '#E91E8C', fontWeight: '700', fontSize: 14 },
  joinBtn: { backgroundColor: '#8DC63F', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnText: { color: '#000000', fontWeight: '800', fontSize: 13 },
  pendingPill: { backgroundColor: '#2A2A2A', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  pendingPillText: { color: '#999999', fontWeight: '700', fontSize: 13 },
});
