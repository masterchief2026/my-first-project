import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { calculateStreak, getStreakMultiplier, StreakResult } from '../lib/streak';
import { getQuote } from '../lib/quotes';
import { getLevel, xpProgressInLevel } from '../lib/xp';
import QuoteSplash from '../components/QuoteSplash';

type League = { id: string; name: string; invite_code: string; logo_url: string | null };
type NextRace = { name: string; race_date: string } | null;

type FeedItem =
  | { kind: 'activity'; id: string; userId: string; name: string; activityType: string; activityName: string | null; durationSeconds: number; distanceMeters: number; xp: number; photoUrl: string | null; ts: string }
  | { kind: 'race'; id: string; userId: string; name: string; raceName: string; raceDate: string; ts: string };

const ACTIVITY_ICONS: Record<string, string> = {
  Run: '🏃', Ride: '🚴', Swim: '🏊', WeightTraining: '🏋️', Workout: '💪',
  Hike: '🥾', Walk: '🚶', Yoga: '🧘', CrossFit: '🤸', Rowing: '🚣',
  Hyrox: '🔥', HIIT: '⚡', AlpineSki: '⛷️', NordicSki: '🎿', VirtualRun: '🏃', VirtualRide: '🚴',
};

const AVATAR_COLORS = ['#E91E8C', '#8DC63F', '#FF6B35', '#4FC3F7', '#AB47BC', '#26A69A'];

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const race = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getThisWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function HomeScreen() {
  const [displayName, setDisplayName] = useState('');
  const [userId, setUserId] = useState('');
  const [stravaConnected, setStravaConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [thisWeekXp, setThisWeekXp] = useState(0);
  const [nextRace, setNextRace] = useState<NextRace>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [quote] = useState(getQuote);
  const [showSplash, setShowSplash] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  useFocusEffect(useCallback(() => {
    loadAll();
  }, []));

  async function loadAll() {
    setFeedLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const uId = user.id;
    const uName = user.user_metadata?.display_name || 'Athlete';
    setDisplayName(uName);
    setUserId(uId);

    const today = new Date().toISOString().split('T')[0];
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Phase 1: own data + strava status
    const [stravaRes, activitiesRes, leaguesRes, raceRes, userProfileRes] = await Promise.all([
      supabase.from('fitness_connections').select('id').eq('user_id', uId).eq('provider', 'strava').maybeSingle(),
      supabase.from('activities').select('started_at, effort_score').eq('user_id', uId),
      supabase.from('league_members').select('league_id, leagues(id, name, invite_code, logo_url)').eq('user_id', uId),
      supabase.from('races').select('name, race_date').eq('user_id', uId).gte('race_date', today).order('race_date', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('users').select('avatar_url').eq('id', uId).single(),
    ]);

    setStravaConnected(!!stravaRes.data);
    setNextRace(raceRes.data ?? null);
    const myAvatarUrl: string | null = userProfileRes.data?.avatar_url || null;
    setAvatarUrl(myAvatarUrl);

    const leagueList = leaguesRes.data?.map((m: any) => m.leagues).filter(Boolean) ?? [];
    setLeagues(leagueList);
    const leagueIds = leaguesRes.data?.map((m: any) => m.league_id) ?? [];

    const activities = activitiesRes.data || [];
    setStreak(calculateStreak(activities));
    setTotalXp(activities.reduce((s, a) => s + (a.effort_score || 0), 0));
    const weekStart = getThisWeekStart();
    setThisWeekXp(
      activities
        .filter(a => new Date(a.started_at) >= weekStart)
        .reduce((s, a) => s + (a.effort_score || 0), 0)
    );

    // Phase 2: get all league mates
    const matesRes = leagueIds.length > 0
      ? await supabase.from('league_members').select('user_id, users(display_name, email, avatar_url)').in('league_id', leagueIds)
      : { data: [] as any[] };

    const matesData = matesRes.data ?? [];
    const nameMap: Record<string, string> = { [uId]: uName };
    const newAvatarMap: Record<string, string | null> = { [uId]: myAvatarUrl };
    matesData.forEach((m: any) => {
      nameMap[m.user_id] = m.users?.display_name || m.users?.email?.split('@')[0] || 'Athlete';
      newAvatarMap[m.user_id] = m.users?.avatar_url || null;
    });
    setAvatarMap(newAvatarMap);

    const allUserIds = [...new Set([...matesData.map((m: any) => m.user_id as string), uId])];

    // Phase 3: feed data — activities + race signups only
    const [feedActivitiesRes, feedRacesRes] = await Promise.all([
      supabase.from('activities')
        .select('id, user_id, name, activity_type, started_at, duration_seconds, distance_meters, effort_score, photo_url')
        .in('user_id', allUserIds)
        .gte('started_at', twoWeeksAgo.toISOString())
        .order('started_at', { ascending: false })
        .limit(60),
      supabase.from('races')
        .select('id, user_id, name, race_date, created_at')
        .in('user_id', allUserIds)
        .order('race_date', { ascending: false })
        .limit(20),
    ]);

    const items: FeedItem[] = [];

    feedActivitiesRes.data?.forEach(a => {
      if (!a.started_at) return;
      items.push({
        kind: 'activity', id: a.id, userId: a.user_id,
        name: nameMap[a.user_id] ?? 'Athlete',
        activityType: a.activity_type,
        activityName: a.name,
        durationSeconds: a.duration_seconds,
        distanceMeters: a.distance_meters,
        xp: Math.round((a.effort_score || 0) * 10) / 10,
        photoUrl: a.photo_url ?? null,
        ts: a.started_at,
      });
    });

    feedRacesRes.data?.forEach(r => {
      const ts = r.created_at || r.race_date;
      if (!ts) return;
      items.push({
        kind: 'race', id: r.id, userId: r.user_id,
        name: nameMap[r.user_id] ?? 'Athlete',
        raceName: r.name,
        raceDate: r.race_date,
        ts,
      });
    });

    items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    setFeedItems(items.slice(0, 40));
    setFeedLoading(false);
  }

  async function runBackfill() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setSyncing(true);
    try {
      await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/strava-backfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        },
      });
    } catch {}
    finally { setSyncing(false); loadAll(); }
  }

  async function connectStrava() {
    const clientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
    const redirectUri = typeof window !== 'undefined'
      ? `${window.location.origin}/strava-callback`
      : process.env.EXPO_PUBLIC_STRAVA_REDIRECT_URI;
    const { data: { session } } = await supabase.auth.getSession();
    const stravaUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=read,activity:read_all&state=${session?.access_token ?? ''}`;
    if (Platform.OS === 'web') {
      const popup = window.open(stravaUrl, 'strava-auth', 'width=600,height=700');
      const interval = setInterval(() => {
        try {
          if (popup?.closed) { clearInterval(interval); loadAll(); }
        } catch { clearInterval(interval); }
      }, 500);
    }
  }

  const level = getLevel(totalXp);
  const { pct } = xpProgressInLevel(totalXp);
  const days = nextRace ? daysUntil(nextRace.race_date) : null;
  const streakMultiplier = streak ? getStreakMultiplier(streak.current) : 1.0;
  const streakBonusXp = streak?.activeThisWeek && streakMultiplier > 1.0
    ? Math.round(thisWeekXp * (streakMultiplier - 1.0))
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {showSplash && (
        <QuoteSplash quote={quote} onDismiss={() => setShowSplash(false)} />
      )}

      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>RIVAL</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerNavBtn} onPress={() => router.push('/plan')}>
              <Text style={styles.headerNavIcon}>Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerNavBtn} onPress={() => router.push('/goals')}>
              <Text style={styles.headerNavIcon}>Goals</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerNavBtn} onPress={() => router.push('/races')}>
              <Text style={styles.headerNavIcon}>Races</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerNavBtn} onPress={() => router.push('/achievements')}>
              <Text style={styles.headerNavIcon}>Badges</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerNavBtn} onPress={() => router.push('/friends')}>
              <Text style={styles.headerNavIcon}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/profile')}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  <Text style={styles.headerAvatarText}>{displayName ? displayName[0].toUpperCase() : '?'}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Hey, {displayName}</Text>
          {thisWeekXp > 0 && (
            <View style={styles.weekXpPill}>
              <Text style={styles.weekXpText}>+{Math.round(thisWeekXp)} XP this week</Text>
            </View>
          )}
          {streakBonusXp > 0 && (
            <View style={styles.streakBonusPill}>
              <Text style={styles.streakBonusText}>🔥 +{streakBonusXp} streak bonus</Text>
            </View>
          )}
        </View>

        {/* Stat tiles */}
        <View style={styles.statRow}>
          <TouchableOpacity style={styles.statTile} onPress={() => router.push('/profile')}>
            <Text style={styles.statIcon}>{streak && streak.current > 0 ? '🔥' : '💤'}</Text>
            <Text style={styles.statValue}>
              {streak ? (streak.current > 0 ? `${streak.current}w` : '—') : '—'}
            </Text>
            <Text style={styles.statLabel}>Streak</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statTile, styles.statTileCenter]} onPress={() => router.push('/ranks')}>
            <Text style={styles.statIcon}>{level.icon}</Text>
            <Text style={[styles.statValue, { color: level.color, fontSize: 14 }]}>{level.name}</Text>
            <Text style={styles.statLabel}>{Math.round(totalXp)} XP</Text>
            <View style={styles.xpMiniTrack}>
              <View style={[styles.xpMiniFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: level.color }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statTile} onPress={() => router.push('/races')}>
            <Text style={styles.statIcon}>🏁</Text>
            <Text style={styles.statValue}>{days !== null ? `${days}d` : '—'}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {nextRace ? nextRace.name : 'No race'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Strava CTA */}
        {!stravaConnected && (
          <TouchableOpacity style={styles.stravaCard} onPress={connectStrava}>
            <View>
              <Text style={styles.stravaCardTitle}>Connect Strava</Text>
              <Text style={styles.stravaCardSub}>Link your account to earn XP from workouts</Text>
            </View>
            <Text style={styles.stravaCardArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Strava connected */}
        {stravaConnected && (
          <View style={styles.stravaConnectedBlock}>
            <TouchableOpacity style={styles.syncRow} onPress={runBackfill} disabled={syncing}>
              <Text style={styles.syncConnected}>✓ Strava connected</Text>
              <Text style={[styles.syncBtn, syncing && { opacity: 0.4 }]}>
                {syncing ? 'Syncing…' : 'Sync'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.activitiesLink} onPress={() => router.push('/my-activities')}>
              <Text style={styles.activitiesLinkText}>View my activities →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Leagues */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Leagues</Text>
        </View>

        {leagues.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏟️</Text>
            <Text style={styles.emptyText}>You're not in any leagues yet.</Text>
            <Text style={styles.emptySubText}>Create one or ask a friend for an invite code.</Text>
          </View>
        ) : (
          <View style={styles.leagueList}>
            {leagues.map((league) => (
              <TouchableOpacity
                key={league.id}
                style={styles.leagueCard}
                onPress={() => router.push({ pathname: '/league', params: { id: league.id } })}
              >
                {league.logo_url ? (
                  <Image source={{ uri: league.logo_url }} style={styles.leagueLogoSmall} />
                ) : (
                  <View style={styles.leagueLogoPlaceholder}>
                    <Text>🏟️</Text>
                  </View>
                )}
                <Text style={styles.leagueName}>{league.name}</Text>
                <Text style={styles.leagueArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.leagueActions}>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/create-league')}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/join-league')}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>

        {/* Feed */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What's happening</Text>
        </View>

        {feedLoading ? (
          <Text style={styles.feedLoadingText}>Loading…</Text>
        ) : feedItems.length === 0 ? (
          <View style={styles.feedEmpty}>
            <Text style={styles.feedEmptyIcon}>🏋️</Text>
            <Text style={styles.feedEmptyText}>No activity yet</Text>
            <Text style={styles.feedEmptySubText}>Join leagues to see your friends' workouts here.</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {feedItems.map(item => {
              const color = avatarColor(item.name);
              const initials = item.name.slice(0, 2).toUpperCase();
              const isMe = item.userId === userId;
              const displayedName = isMe ? 'You' : item.name;

              const userRow = (
                <View style={styles.feedUserRow}>
                  <View style={[styles.feedAvatar, { backgroundColor: color + '33', borderColor: color }]}>
                    {avatarMap[item.userId] ? (
                      <Image source={{ uri: avatarMap[item.userId]! }} style={styles.feedAvatarImg} />
                    ) : (
                      <Text style={[styles.feedAvatarText, { color }]}>{initials}</Text>
                    )}
                  </View>
                  <Text style={styles.feedUserName}>{displayedName}</Text>
                  <Text style={styles.feedTimeAgo}>{timeAgo(item.ts)}</Text>
                </View>
              );

              if (item.kind === 'activity') {
                const icon = ACTIVITY_ICONS[item.activityType] ?? '🏅';
                const distKm = item.distanceMeters > 100
                  ? ` · ${(item.distanceMeters / 1000).toFixed(1)} km`
                  : '';
                return (
                  <View key={`act-${item.id}`} style={styles.feedCard}>
                    {userRow}
                    <View style={styles.feedActivityRow}>
                      <Text style={styles.feedActivityIcon}>{icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.feedActivityType}>{item.activityName || item.activityType}</Text>
                        <Text style={styles.feedActivityMeta}>{formatDuration(item.durationSeconds)}{distKm}</Text>
                      </View>
                      {item.xp > 0 && (
                        <View style={styles.feedXpPill}>
                          <Text style={styles.feedXpText}>+{item.xp} XP</Text>
                        </View>
                      )}
                    </View>
                    {item.photoUrl && (
                      <Image source={{ uri: item.photoUrl }} style={styles.feedPhoto} resizeMode="contain" />
                    )}
                  </View>
                );
              }

              if (item.kind === 'race') {
                const raceDateLabel = new Date(item.raceDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <View key={`race-${item.id}`} style={[styles.feedCard, styles.feedCardRace]}>
                    {userRow}
                    <Text style={styles.feedRaceAction}>🏁 signed up for a race</Text>
                    <Text style={styles.feedRaceName}>{item.raceName}</Text>
                    <Text style={styles.feedRaceDate}>{raceDateLabel}</Text>
                  </View>
                );
              }

              return null;
            })}
          </View>
        )}


      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerNavBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  headerNavIcon: { fontSize: 12, fontWeight: '700', color: '#999999', letterSpacing: 0.3 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, marginLeft: 6 },
  headerAvatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E91E8C', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  headerAvatarText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  weekXpPill: { backgroundColor: '#8DC63F22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#8DC63F55' },
  weekXpText: { fontSize: 11, fontWeight: '700', color: '#8DC63F', letterSpacing: 0.5 },
  streakBonusPill: { backgroundColor: '#E91E8C22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#E91E8C55' },
  streakBonusText: { fontSize: 11, fontWeight: '700', color: '#E91E8C', letterSpacing: 0.5 },

  statRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statTile: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#8DC63F' },
  statTileCenter: { borderColor: '#E91E8C' },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#999999', fontWeight: '600', textAlign: 'center' },
  xpMiniTrack: { height: 3, backgroundColor: '#2A2A2A', borderRadius: 2, width: '100%', marginTop: 4 },
  xpMiniFill: { height: '100%', borderRadius: 2 },

  stravaCard: { backgroundColor: '#7c1500', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#fc4c02' },
  stravaCardTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  stravaCardSub: { fontSize: 12, color: '#fca07a', marginTop: 2 },
  stravaCardArrow: { fontSize: 20, color: '#fc4c02' },

  stravaConnectedBlock: { gap: 0, marginBottom: 20 },
  syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#052e16', borderTopLeftRadius: 10, borderTopRightRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#16a34a' },
  syncConnected: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  syncBtn: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  activitiesLink: { backgroundColor: '#1A1A1A', borderWidth: 1, borderTopWidth: 0, borderColor: '#16a34a', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  activitiesLinkText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  // Feed
  feedList: { gap: 0 },
  feedLoadingText: { color: '#555555', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  feedEmpty: { paddingVertical: 36, alignItems: 'center', gap: 8 },
  feedEmptyIcon: { fontSize: 36, marginBottom: 4 },
  feedEmptyText: { fontSize: 15, fontWeight: '700', color: '#555555' },
  feedEmptySubText: { fontSize: 13, color: '#444444', textAlign: 'center' },

  feedCard: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A', gap: 10 },
  feedCardRace: { borderColor: '#8DC63F55' },

  feedUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  feedAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  feedAvatarText: { fontSize: 13, fontWeight: '800' },
  feedUserName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  feedTimeAgo: { fontSize: 12, color: '#555555' },

  feedActivityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedActivityIcon: { fontSize: 26 },
  feedActivityType: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  feedActivityMeta: { fontSize: 13, color: '#666666', marginTop: 2 },
  feedXpPill: { backgroundColor: '#8DC63F22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#8DC63F55' },
  feedXpText: { fontSize: 12, fontWeight: '800', color: '#8DC63F' },

  feedPhoto: { width: '100%', height: 320, borderRadius: 10, backgroundColor: '#2A2A2A' },

  feedRaceAction: { fontSize: 13, color: '#8DC63F', fontWeight: '600' },
  feedRaceName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  feedRaceDate: { fontSize: 13, color: '#666666' },

  // Leagues
  emptyState: { paddingVertical: 28, alignItems: 'center', gap: 6 },
  emptyIcon: { fontSize: 32, marginBottom: 4 },
  emptyText: { fontSize: 14, color: '#666666', textAlign: 'center' },
  emptySubText: { fontSize: 12, color: '#444444', textAlign: 'center' },

  leagueList: { gap: 8, marginBottom: 12 },
  leagueCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#8DC63F', flexDirection: 'row', alignItems: 'center', gap: 12 },
  leagueLogoSmall: { width: 36, height: 36, borderRadius: 8 },
  leagueLogoPlaceholder: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  leagueName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  leagueArrow: { fontSize: 16, color: '#E91E8C' },

  leagueActions: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  createBtn: { flex: 1, backgroundColor: '#E91E8C', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  createBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  joinBtn: { flex: 1, borderWidth: 1, borderColor: '#E91E8C', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  joinBtnText: { color: '#E91E8C', fontSize: 15, fontWeight: '700' },

});
