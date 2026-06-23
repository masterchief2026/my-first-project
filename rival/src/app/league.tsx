import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Share, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getLevel } from '../lib/xp';

type Member = {
  user_id: string;
  role: string;
  users: { email: string; display_name: string | null; avatar_url: string | null };
  total_score: number;
  last_week_score: number;
  all_time_xp: number;
  rank_change: number | null; // positive = moved up, negative = moved down, null = no prior data
  isHot: boolean;
};

type League = {
  id: string;
  name: string;
  invite_code: string;
  is_private: boolean;
  created_by: string;
  logo_url: string | null;
};

export default function LeagueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mvpUserId, setMvpUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => { loadLeague(); }, [id]);
  useEffect(() => { if (!loading) loadWeekScores(); }, [weekOffset]);

  function getWeekWindow(offset: number) {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  function weekLabel(offset: number) {
    if (offset === 0) return "This week's standings";
    if (offset === -1) return "Last week's standings";
    const { start, end } = getWeekWindow(offset);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const endDay = new Date(end);
    endDay.setDate(endDay.getDate() - 1);
    return `${start.toLocaleDateString('en-US', opts)} – ${endDay.toLocaleDateString('en-US', opts)}`;
  }

  async function loadLeague() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data: leagueData } = await supabase.from('leagues').select('*').eq('id', id).single();
    if (leagueData) setLeague(leagueData);

    const { data: membersData } = await supabase
      .from('league_members')
      .select('user_id, role, users(email, display_name, avatar_url)')
      .eq('league_id', id);

    if (user && membersData) {
      const adminCheck = membersData.find((m: any) => m.user_id === user.id);
      setIsAdmin(adminCheck?.role === 'admin');
    }

    if (membersData) await scoreMembers(membersData, 0);
    setLoading(false);
  }

  async function loadWeekScores() {
    const { data: membersData } = await supabase
      .from('league_members')
      .select('user_id, role, users(email, display_name, avatar_url)')
      .eq('league_id', id);
    if (membersData) await scoreMembers(membersData, weekOffset);
  }

  async function scoreMembers(membersData: any[], offset: number) {
    const { start, end } = getWeekWindow(offset);
    const { start: lastStart, end: lastEnd } = getWeekWindow(offset - 1);

    const membersWithScores = await Promise.all(
      membersData.map(async (m: any) => {
        const [weekRes, prevRes, allRes] = await Promise.all([
          supabase.from('activities').select('effort_score').eq('user_id', m.user_id)
            .gte('started_at', start.toISOString()).lt('started_at', end.toISOString()),
          supabase.from('activities').select('effort_score').eq('user_id', m.user_id)
            .gte('started_at', lastStart.toISOString()).lt('started_at', lastEnd.toISOString()),
          supabase.from('activities').select('effort_score').eq('user_id', m.user_id),
        ]);

        const total = weekRes.data?.reduce((s, a) => s + (a.effort_score || 0), 0) ?? 0;
        const lastWeekTotal = prevRes.data?.reduce((s, a) => s + (a.effort_score || 0), 0) ?? 0;
        const allTimeXp = allRes.data?.reduce((s, a) => s + (a.effort_score || 0), 0) ?? 0;

        return {
          ...m,
          total_score: Math.round(total * 10) / 10,
          last_week_score: Math.round(lastWeekTotal * 10) / 10,
          all_time_xp: allTimeXp,
          rank_change: null as number | null,
          isHot: false,
        };
      })
    );

    // MVP = highest scorer in the prior week
    const mvp = [...membersWithScores]
      .filter((m) => m.last_week_score > 0)
      .sort((a, b) => b.last_week_score - a.last_week_score)[0];
    setMvpUserId(mvp?.user_id ?? null);

    // Compute rank change: diff between last week's rank order and this week's
    const lastWeekRanked = [...membersWithScores].sort((a, b) => b.last_week_score - a.last_week_score);
    const lastWeekRankMap: Record<string, number> = {};
    lastWeekRanked.forEach((m, i) => { if (m.last_week_score > 0) lastWeekRankMap[m.user_id] = i; });

    membersWithScores.sort((a, b) => b.total_score - a.total_score);

    membersWithScores.forEach((m, i) => {
      const lastRank = lastWeekRankMap[m.user_id];
      m.rank_change = lastRank !== undefined ? lastRank - i : null;
      m.isHot = m.total_score > 0 && m.last_week_score > 0;
    });

    setMembers(membersWithScores);
  }

  function getDisplayName(member: Member) {
    return member.users?.display_name || member.users?.email?.split('@')[0] || 'Athlete';
  }

  function getRankEmoji(index: number) {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  }

  function RankArrow({ change }: { change: number | null }) {
    if (change === null || change === 0) return <Text style={styles.rankArrowNeutral}>—</Text>;
    if (change > 0) return <Text style={styles.rankArrowUp}>↑{change}</Text>;
    return <Text style={styles.rankArrowDown}>↓{Math.abs(change)}</Text>;
  }

  async function copyInviteCode() {
    if (!league) return;
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(league.invite_code);
    } else {
      await Share.share({ message: `Join my RIVAL league with code: ${league.invite_code}` });
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><Text style={styles.loadingText}>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  if (!league) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><Text style={styles.loadingText}>League not found.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => router.push({ pathname: '/league-settings', params: { id } })}>
              <Text style={styles.settingsLink}>⚙️ Settings</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.leagueHeaderRow}>
          {league.logo_url ? (
            <Image source={{ uri: league.logo_url }} style={styles.leagueLogoImg} />
          ) : (
            <View style={styles.leagueLogoPlaceholder}>
              <Text style={styles.leagueLogoPlaceholderText}>🏟️</Text>
            </View>
          )}
          <Text style={styles.leagueName}>{league.name}</Text>
        </View>

        {/* Week navigator */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={styles.weekArrow}>
            <Text style={styles.weekArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>{weekLabel(weekOffset)}</Text>
          <TouchableOpacity
            onPress={() => setWeekOffset(Math.min(0, weekOffset + 1))}
            style={[styles.weekArrow, weekOffset === 0 && styles.weekArrowDisabled]}
            disabled={weekOffset === 0}
          >
            <Text style={[styles.weekArrowText, weekOffset === 0 && { color: '#3A3A3A' }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Plan week shortcut */}
        {weekOffset === 0 && (
          <TouchableOpacity style={styles.planLink} onPress={() => router.push('/plan')}>
            <Text style={styles.planLinkText}>📋 Plan your week → see where you'll land</Text>
          </TouchableOpacity>
        )}

        {/* Leaderboard */}
        <View style={styles.leaderboard}>
          {members.length === 0 && (
            <Text style={styles.emptyText}>No activity this week yet.</Text>
          )}
          {members.map((member, index) => {
            const lvl = getLevel(member.all_time_xp ?? 0);
            return (
              <View
                key={member.user_id}
                style={[
                  styles.memberRow,
                  member.user_id === currentUserId && styles.memberRowSelf,
                ]}
              >
                {/* Rank position */}
                <Text style={styles.rankEmoji}>{getRankEmoji(index)}</Text>

                {/* Avatar */}
                {member.users?.avatar_url ? (
                  <Image source={{ uri: member.users.avatar_url }} style={styles.memberAvatar} />
                ) : (
                  <View style={styles.memberAvatarFallback}>
                    <Text style={styles.memberAvatarText}>
                      {getDisplayName(member)[0].toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Name + badges */}
                <View style={styles.memberInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.memberName}>
                      {getDisplayName(member)}{member.user_id === currentUserId ? ' (you)' : ''}
                    </Text>
                    {member.isHot && <Text style={styles.hotBadge}>🔥</Text>}
                    {member.user_id === mvpUserId && <Text style={styles.mvpBadge}>👑 MVP</Text>}
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={[styles.lvlBadge, { backgroundColor: lvl.color + '22', borderColor: lvl.color + '55' }]}>
                      <Text style={[styles.lvlBadgeText, { color: lvl.color }]}>LVL {lvl.level}</Text>
                    </View>
                    {member.role === 'admin' && <Text style={styles.adminBadge}>Admin</Text>}
                  </View>
                </View>

                {/* Score + rank change */}
                <View style={styles.scoreBlock}>
                  <Text style={[styles.score, member.total_score === 0 && { color: '#444444' }]}>
                    {member.total_score > 0 ? `${member.total_score} pts` : '—'}
                  </Text>
                  <RankArrow change={member.rank_change} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Invite code */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>Invite code</Text>
          <Text style={styles.inviteCode}>{league.invite_code}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyInviteCode}>
            <Text style={styles.copyButtonText}>{codeCopied ? '✓ Copied!' : 'Copy & Share'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#999999', fontSize: 16 },

  header: { marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: '#E91E8C', fontSize: 16 },
  settingsLink: { color: '#999999', fontSize: 14 },

  leagueHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  leagueLogoImg: { width: 52, height: 52, borderRadius: 12 },
  leagueLogoPlaceholder: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  leagueLogoPlaceholderText: { fontSize: 24 },
  leagueName: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', flex: 1 },

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  weekArrow: { padding: 8 },
  weekArrowText: { fontSize: 28, color: '#E91E8C', lineHeight: 30 },
  weekArrowDisabled: { color: '#3A3A3A' },
  weekLabel: { fontSize: 13, color: '#999999', flex: 1, textAlign: 'center' },

  leaderboard: { gap: 10, marginBottom: 32 },
  emptyText: { color: '#999999', fontSize: 15, textAlign: 'center', paddingVertical: 24 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  memberRowSelf: {
    borderColor: '#E91E8C',
    backgroundColor: '#1A0A12',
  },

  rankEmoji: { fontSize: 20, width: 32, textAlign: 'center' },
  memberAvatar: { width: 36, height: 36, borderRadius: 18 },
  memberAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 14, fontWeight: '800', color: '#999999' },

  memberInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  memberName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  hotBadge: { fontSize: 14 },
  mvpBadge: {
    fontSize: 11, fontWeight: '700', color: '#fbbf24',
    backgroundColor: '#422f10', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, overflow: 'hidden',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lvlBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  lvlBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  adminBadge: { fontSize: 11, color: '#666666', textTransform: 'uppercase', letterSpacing: 1 },

  scoreBlock: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  rankArrowUp: { fontSize: 12, fontWeight: '800', color: '#4ade80' },
  rankArrowDown: { fontSize: 12, fontWeight: '800', color: '#f87171' },
  rankArrowNeutral: { fontSize: 12, color: '#444444' },

  planLink: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#8DC63F33',
    alignItems: 'center',
  },
  planLinkText: { color: '#8DC63F', fontSize: 13, fontWeight: '600' },

  inviteCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#8DC63F',
  },
  inviteLabel: { fontSize: 13, color: '#999999', textTransform: 'uppercase', letterSpacing: 2 },
  inviteCode: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 8 },
  copyButton: { backgroundColor: '#E91E8C', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, marginTop: 4 },
  copyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
