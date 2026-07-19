import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform, ScrollView, Image, ImageBackground, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { fetchAllActivities } from '../lib/fetchAllActivities';
import { notify } from '../lib/notify';
import { calculateStreak, StreakResult } from '../lib/streak';
import { getQuote, QuoteTone } from '../lib/quotes';
import { getLevel } from '../lib/xp';
import { getSeasonStartISO, getCurrentSeasonYear, daysUntilSeasonEnd } from '../lib/season';
import { computeGoalProgress, goalTitle, goalUnit, GoalRow } from '../lib/goalProgress';
import QuoteSplash from '../components/QuoteSplash';
import { RivalButton, RivalCard, RivalProgressBar, RivalIcon, RivalTopNav } from '../components/rival';
import { RivalColors, RivalRadius, RivalType, RANK_LEVEL_COLORS } from '../constants/rivalTheme';

type League = { id: string; name: string; invite_code: string; logo_url: string | null; recentCount?: number };
type NextRace = { name: string; race_date: string } | null;
type FeaturedGoal = {
  title: string;
  progress: number;
  target: number;
  unit: string;
  pct: number;
  daysLeft: number;
};

function todayLocalStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const race = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomeScreen() {
  const [displayName, setDisplayName] = useState('');
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthleteName, setStravaAthleteName] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [seasonActivityCount, setSeasonActivityCount] = useState(0);
  const [nextRace, setNextRace] = useState<NextRace>(null);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [totalElevationM, setTotalElevationM] = useState(0);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(0);
  const [featuredGoal, setFeaturedGoal] = useState<FeaturedGoal | null>(null);
  const [inspiredTimes, setInspiredTimes] = useState(0);
  const [quote, setQuote] = useState(() => getQuote());
  const [showSplash, setShowSplash] = useState(true);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<{ id: string; activity_type: string } | null>(null);

  useFocusEffect(useCallback(() => {
    loadAll();
  }, []));

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const uId = user.id;
    const uName = user.user_metadata?.display_name || 'Athlete';
    setDisplayName(uName);

    const today = todayLocalStr();

    // Phase 1: own data + strava status
    const [stravaRes, activitiesRes, leaguesRes, raceRes, userProfileRes, goalsRes, raceIdsRes] = await Promise.all([
      supabase.from('fitness_connections').select('athlete_firstname, athlete_lastname').eq('user_id', uId).eq('provider', 'strava').maybeSingle(),
      fetchAllActivities(uId, 'id, started_at, effort_score, distance_meters, elevation_meters, activity_type, duration_seconds'),
      supabase.from('league_members').select('league_id, leagues(id, name, invite_code, logo_url)').eq('user_id', uId).eq('status', 'active'),
      supabase.from('races').select('name, race_date').eq('user_id', uId).gte('race_date', today).order('race_date', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('users').select('avatar_url, quote_tone').eq('id', uId).single(),
      supabase.from('goals').select('*').eq('user_id', uId),
      supabase.from('races').select('id').eq('user_id', uId),
    ]);

    setStravaConnected(!!stravaRes.data);
    setStravaAthleteName(
      stravaRes.data ? [stravaRes.data.athlete_firstname, stravaRes.data.athlete_lastname].filter(Boolean).join(' ') || null : null
    );
    setNextRace(raceRes.data ?? null);
    const myAvatarUrl: string | null = userProfileRes.data?.avatar_url || null;
    setAvatarUrl(myAvatarUrl);
    const savedTone = userProfileRes.data?.quote_tone as QuoteTone | undefined;
    if (savedTone && savedTone !== 'balanced') setQuote(getQuote(savedTone));

    const leagueList = leaguesRes.data?.map((m: any) => m.leagues).filter(Boolean) ?? [];
    setLeagues(leagueList);
    const leagueIds = leaguesRes.data?.map((m: any) => m.league_id) ?? [];

    const activities = activitiesRes;
    const mostRecent = [...activities].sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))[0];
    setLastActivity(mostRecent ? { id: (mostRecent as any).id, activity_type: mostRecent.activity_type } : null);
    setStreak(calculateStreak(activities));
    setTotalDistanceKm(Math.round(activities.reduce((s, a) => s + (a.distance_meters || 0), 0) / 1000));
    setTotalElevationM(Math.round(activities.reduce((s, a) => s + (a.elevation_meters || 0), 0)));
    setTotalTimeMinutes(Math.round(activities.reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60));

    const seasonStart = new Date(getSeasonStartISO());
    const seasonActivities = activities.filter(a => new Date(a.started_at) >= seasonStart);
    setTotalXp(seasonActivities.reduce((s, a) => s + (a.effort_score || 0), 0));
    setSeasonActivityCount(seasonActivities.length);

    // Featured goal: the ACTIVE goal nearest its deadline (tie-break: most
    // complete). One goal on the dashboard, deliberately — Ricky's call:
    // showing several dilutes focus; the card links to /goals for the rest.
    const now = new Date();
    const activeGoals = ((goalsRes.data ?? []) as (GoalRow & { target_value: number })[])
      .filter(g => { const end = new Date(g.end_date); end.setHours(23, 59, 59, 999); return end >= now; })
      .map(g => {
        const progress = computeGoalProgress(g, activities);
        const end = new Date(g.end_date); end.setHours(23, 59, 59, 999);
        return {
          endMs: end.getTime(),
          goal: g,
          progress,
          pct: g.target_value > 0 ? Math.min(1, progress / g.target_value) : 0,
        };
      })
      .sort((a, b) => a.endMs - b.endMs || b.pct - a.pct);
    if (activeGoals.length > 0) {
      const top = activeGoals[0];
      setFeaturedGoal({
        title: goalTitle(top.goal),
        progress: top.progress,
        target: top.goal.target_value,
        unit: goalUnit(top.goal.goal_type),
        pct: top.pct,
        daysLeft: Math.max(0, Math.ceil((top.endMs - now.getTime()) / (1000 * 60 * 60 * 24))),
      });
    } else {
      setFeaturedGoal(null);
    }

    // Impact (times people showed up for your effort) — same definition as the
    // Profile Impact card: 'inspired' reactions on your activities and races,
    // excluding your own.
    const myActivityIds = activities.map((a: any) => a.id);
    const myRaceIds = (raceIdsRes.data ?? []).map((r: any) => r.id);
    const reactionQueries: PromiseLike<{ data: { user_id: string }[] | null }>[] = [];
    if (myActivityIds.length > 0) reactionQueries.push(supabase.from('feed_reactions').select('user_id').eq('target_type', 'activity').eq('emoji', 'inspired').in('target_id', myActivityIds));
    if (myRaceIds.length > 0) reactionQueries.push(supabase.from('feed_reactions').select('user_id').eq('target_type', 'race').eq('emoji', 'inspired').in('target_id', myRaceIds));
    if (reactionQueries.length > 0) {
      const reactionResults = await Promise.all(reactionQueries);
      let times = 0;
      reactionResults.forEach(r => (r.data || []).forEach(row => { if (row.user_id !== uId) times += 1; }));
      setInspiredTimes(times);
    } else {
      setInspiredTimes(0);
    }

    // Per-league "new activity" teaser count — powers the Team Momentum card
    if (leagueIds.length > 0) {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const { data: leagueMembersData } = await supabase
        .from('league_members')
        .select('league_id, user_id')
        .in('league_id', leagueIds)
        .eq('status', 'active');

      const memberIdsByLeague: Record<string, string[]> = {};
      (leagueMembersData || []).forEach((m: any) => {
        if (!memberIdsByLeague[m.league_id]) memberIdsByLeague[m.league_id] = [];
        memberIdsByLeague[m.league_id].push(m.user_id);
      });

      const allMemberIds = [...new Set((leagueMembersData || []).map((m: any) => m.user_id as string))];
      const { data: recentActivities } = await supabase
        .from('activities')
        .select('user_id')
        .in('user_id', allMemberIds)
        .gte('started_at', twoDaysAgo.toISOString());

      const leagueListWithCounts = leagueList.map((l: League) => {
        const memberIds = new Set(memberIdsByLeague[l.id] || []);
        const count = (recentActivities || []).filter((a: any) => a.user_id !== uId && memberIds.has(a.user_id)).length;
        return { ...l, recentCount: count };
      });
      // Most-active teams first — Momentum is "who's training right now", and
      // only the top few show by default (mockup keeps this card compact).
      leagueListWithCounts.sort((a: League, b: League) => (b.recentCount ?? 0) - (a.recentCount ?? 0));
      setLeagues(leagueListWithCounts);
    }
  }

  async function runBackfill() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setSyncing(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/strava-backfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        notify('Sync failed', data.error || 'Could not sync with Strava. Try reconnecting Strava.');
      } else if (data.saved === 0) {
        notify('Nothing new', 'No new Strava activities found.');
      }
    } catch {
      notify('Sync failed', 'Could not reach the server. Check your connection and try again.');
    } finally {
      setSyncing(false);
      loadAll();
      // Fire-and-forget milestone check after every sync
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-milestones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! },
        }).catch(() => {});
      });
    }
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
  const rankColor = RANK_LEVEL_COLORS[level.level - 1] ?? RivalColors.accentText;
  // The mockup's 4-card row must stay 4-across on desktop — explicit quarter
  // widths above the breakpoint, natural wrapping (2-up/stacked) below it.
  const { width: windowWidth } = useWindowDimensions();
  const fourUp = windowWidth >= 840;
  const gridCardStyle = fourUp ? [styles.gridCard, styles.gridCardQuarter] : styles.gridCard;
  const days = nextRace ? daysUntil(nextRace.race_date) : null;
  const seasonYear = getCurrentSeasonYear();
  const seasonDaysLeft = daysUntilSeasonEnd();

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed viewport-covering background, decoupled from content height —
          a long team/stats list scrolling taller than one screen must never
          outgrow the photo (same fix as league.tsx). */}
      <ImageBackground
        source={require('../../assets/images/backgrounds/optimized/a-single-solo-athlete-standing-on.jpg')}
        style={styles.bgFixed}
        resizeMode="cover"
      />
      <View style={styles.scrim} />
      <SafeAreaView style={styles.container}>
        {showSplash && (
          <QuoteSplash quote={quote} onDismiss={() => setShowSplash(false)} />
        )}

        <RivalTopNav active="today" />

        <ScrollView contentContainerStyle={styles.content}>

          {/* Greeting */}
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>Hey, {displayName}</Text>
            <Text style={styles.greetingSub}>{quote.text}</Text>
          </View>

          {/* Hero: Total Time Earned — narrower + centered like the mockup */}
          <RivalCard glass style={styles.heroCard}>
            <View style={styles.iconDisc}><Text style={styles.heroIcon}>⏱</Text></View>
            <Text style={styles.heroLabel}>TOTAL TIME EARNED</Text>
            <Text style={styles.heroValue}>
              {Math.floor(totalTimeMinutes / 60) > 0 ? `${Math.floor(totalTimeMinutes / 60)}h ` : ''}
              {totalTimeMinutes % 60}m
            </Text>
            <Text style={styles.heroSub}>Every minute in here is yours. You earned it.</Text>
          </RivalCard>

          <RivalButton label="+ Add Workout" onPress={() => router.push('/add-workout')} style={styles.addWorkoutPill} />

          {/* Season countdown (last 30 days of the year only) */}
          {seasonDaysLeft <= 30 && seasonDaysLeft > 0 && (
            <TouchableOpacity style={styles.seasonBanner} onPress={() => router.push('/ranks')}>
              <Text style={styles.bannerIcon}>⏳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>{seasonDaysLeft} days left in the {seasonYear} season</Text>
                <Text style={styles.bannerSub}>Push your rank now — Effort resets Jan 1</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 4-card grid */}
          <View style={styles.cardRow}>

            {/* Featured goal — nearest deadline; card named after the goal itself */}
            <RivalCard glass style={gridCardStyle}>
              {featuredGoal ? (
                <>
                  <View style={styles.cardTagRow}>
                    <View style={styles.tag}><Text style={styles.tagText}>{featuredGoal.title}</Text></View>
                  </View>
                  <Text style={styles.gridCardValue}>
                    {featuredGoal.progress.toLocaleString()}
                    <Text style={styles.gridCardValueSub}> / {featuredGoal.target.toLocaleString()} {featuredGoal.unit}</Text>
                  </Text>
                  <RivalProgressBar pct={featuredGoal.pct} />
                  <Text style={styles.gridCardMeta}>
                    {featuredGoal.daysLeft === 0 ? 'Last day' : `${featuredGoal.daysLeft} day${featuredGoal.daysLeft === 1 ? '' : 's'} remaining`}
                  </Text>
                  <TouchableOpacity style={styles.gridCardBtn} onPress={() => router.push('/goals')}>
                    <Text style={styles.gridCardBtnText}>View Goals</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.cardTagRow}>
                    <View style={styles.tag}><Text style={styles.tagText}>GOALS</Text></View>
                  </View>
                  <Text style={styles.gridCardEmptyText}>Nothing you're working towards yet.</Text>
                  <TouchableOpacity style={styles.gridCardBtn} onPress={() => router.push('/goals')}>
                    <Text style={styles.gridCardBtnText}>Set a Goal</Text>
                  </TouchableOpacity>
                </>
              )}
            </RivalCard>

            {/* Streak */}
            <RivalCard glass style={[...(Array.isArray(gridCardStyle) ? gridCardStyle : [gridCardStyle]), styles.streakCardCenter]}>
              <View style={styles.iconDisc}><RivalIcon name={streak && streak.current > 0 ? 'fire' : 'rest'} size={24} color={RivalColors.textPrimary} /></View>
              <Text style={styles.gridCardLabel}>CURRENT STREAK</Text>
              <Text style={styles.streakValue}>
                {streak?.current ?? 0} <Text style={styles.gridCardValueSub}>WEEK{(streak?.current ?? 0) === 1 ? '' : 'S'}</Text>
              </Text>
              <Text style={styles.gridCardMeta}>Longest streak: {streak?.longestEver ?? 0} weeks</Text>
              {/* Tier pips — the mockup's dash row, mapped to the real 2/4/8/12-week streak tiers */}
              <View style={styles.pipRow}>
                {[2, 4, 8, 12].map((weeks) => (
                  <View key={weeks} style={[styles.pip, (streak?.current ?? 0) >= weeks && styles.pipActive]} />
                ))}
              </View>
            </RivalCard>

            {/* Team Momentum */}
            <RivalCard glass style={gridCardStyle}>
              <Text style={styles.gridCardTitle}>Team Momentum</Text>
              {leagues.length === 0 ? (
                <>
                  <Text style={styles.gridCardEmptyText}>You're not in any teams yet.</Text>
                  <TouchableOpacity style={styles.gridCardBtn} onPress={() => router.push('/create-league')}>
                    <Text style={styles.gridCardBtnText}>+ Create a Team</Text>
                  </TouchableOpacity>
                  <View style={styles.teamEmptyLinks}>
                    <TouchableOpacity onPress={() => router.push('/join-league')}>
                      <Text style={styles.teamEmptyLink}>Join with code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => router.push('/discover-leagues')}>
                      <RivalIcon name="search" size={13} color={RivalColors.textSecondary} />
                      <Text style={styles.teamEmptyLink}>Discover</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {(showAllTeams ? leagues : leagues.slice(0, 4)).map((league) => (
                    <TouchableOpacity
                      key={league.id}
                      style={styles.momentumRow}
                      onPress={() => router.push({ pathname: '/league', params: { id: league.id } })}
                    >
                      {league.logo_url ? (
                        <Image source={{ uri: league.logo_url }} style={styles.momentumLogo} />
                      ) : (
                        <View style={styles.momentumAvatar}>
                          <Text style={styles.momentumAvatarText}>{league.name.slice(0, 2).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.momentumName} numberOfLines={1}>{league.name}</Text>
                        {league.recentCount && league.recentCount > 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <RivalIcon name="fire" size={11} color={RivalColors.accentText} />
                            <Text style={styles.momentumMeta}>
                              {league.recentCount} new {league.recentCount === 1 ? 'activity' : 'activities'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.momentumMeta}>Quiet — go stir them up</Text>
                        )}
                      </View>
                      <Text style={styles.momentumArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.momentumFooter}>
                    <TouchableOpacity onPress={() => router.push('/discover-leagues')}>
                      <Text style={styles.addTeamLink}>+ Add team</Text>
                    </TouchableOpacity>
                    {leagues.length > 4 && (
                      <TouchableOpacity onPress={() => setShowAllTeams(v => !v)}>
                        <Text style={styles.addTeamLink}>{showAllTeams ? 'Show fewer' : `Show all (${leagues.length})`}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </RivalCard>

            {/* Stats Snapshot */}
            <RivalCard glass style={gridCardStyle}>
              <TouchableOpacity style={styles.snapshotTitleRow} onPress={() => router.push('/stats')}>
                <Text style={styles.gridCardTitle}>STATS SNAPSHOT</Text>
                <Text style={styles.snapshotSeeAll}>See all →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.snapshotRow} onPress={() => router.push('/my-activities')}>
                <View style={styles.snapshotDisc}><RivalIcon name="location" size={15} color={RivalColors.textPrimary} /></View>
                <View><Text style={styles.gridCardLabel}>DISTANCE (KM)</Text><Text style={styles.snapshotValue}>{totalDistanceKm.toLocaleString()}</Text></View>
              </TouchableOpacity>
              <View style={styles.snapshotRow}>
                <View style={styles.snapshotDisc}><RivalIcon name="elevation" size={15} color={RivalColors.textPrimary} /></View>
                <View><Text style={styles.gridCardLabel}>CLIMBED (M)</Text><Text style={styles.snapshotValue}>{totalElevationM.toLocaleString()}</Text></View>
              </View>
              <TouchableOpacity style={styles.snapshotRow} onPress={() => router.push('/races')}>
                <View style={styles.snapshotDisc}><RivalIcon name="race" size={15} color={RivalColors.textPrimary} /></View>
                <View>
                  <Text style={styles.gridCardLabel}>NEXT RACE</Text>
                  <Text style={styles.snapshotValue}>{days !== null ? `${days} Days` : '—'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiShareBox}
                onPress={() => lastActivity ? router.push(`/ai-share?activityId=${lastActivity.id}`) : router.push('/my-activities')}
              >
                <View style={styles.snapshotDisc}><RivalIcon name="ai" size={15} color={RivalColors.textPrimary} /></View>
                <View><Text style={styles.gridCardLabel}>AI SHARE</Text><Text style={styles.snapshotValue}>Generate Story</Text></View>
              </TouchableOpacity>
            </RivalCard>
          </View>

          {/* Season Wrap strip */}
          <RivalCard glass style={styles.seasonWrap}>
            <View style={styles.seasonWrapHeader}>
              <View>
                <Text style={styles.seasonWrapTitle}>SEASON WRAP</Text>
                <Text style={styles.seasonWrapSub}>Your momentum at a glance</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/my-activities')}>
                <Text style={styles.seasonWrapLink}>TRAINING HISTORY →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.seasonWrapRow}>
              <View><Text style={styles.gridCardLabel}>EFFORT</Text><Text style={styles.seasonWrapValue}>{Math.round(totalXp).toLocaleString()}</Text></View>
              <View><Text style={styles.gridCardLabel}>ACTIVITIES</Text><Text style={styles.seasonWrapValue}>{seasonActivityCount}</Text></View>
              <View>
                <Text style={styles.gridCardLabel}>IMPACT</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <RivalIcon name="ai" size={16} color={RivalColors.textPrimary} />
                  <Text style={styles.seasonWrapValue}>{inspiredTimes.toLocaleString()}</Text>
                </View>
              </View>
              <View><Text style={styles.gridCardLabel}>RIVAL RANK</Text><Text style={[styles.seasonWrapRank, { color: rankColor, textShadowColor: `${rankColor}88` }]}>{level.name.toUpperCase()}</Text></View>
            </View>
          </RivalCard>

          {/* Strava connection — not in the Stitch mockup but a real, needed feature */}
          {!stravaConnected ? (
            <TouchableOpacity style={styles.stravaCard} onPress={connectStrava}>
              <View>
                <Text style={styles.stravaCardTitle}>Connect Strava</Text>
                <Text style={styles.stravaCardSub}>Link your account to earn Effort from workouts</Text>
              </View>
              <Text style={styles.stravaCardArrow}>→</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stravaConnectedRow} onPress={runBackfill} disabled={syncing}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <RivalIcon name="check" size={13} color={RivalColors.tertiary} />
                <Text style={styles.syncConnected}>
                  {stravaAthleteName ? `Connected to ${stravaAthleteName}'s Strava` : 'Strava connected'}
                </Text>
              </View>
              <Text style={[styles.syncBtn, syncing && { opacity: 0.4 }]}>
                {syncing ? 'Syncing…' : 'Sync'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Secondary quick links — features the mockup nav doesn't cover */}
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/plan')}>
              <Text style={styles.quickLinkText}>Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/races')}>
              <Text style={styles.quickLinkText}>Races</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/friends')}>
              <Text style={styles.quickLinkText}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/achievements')}>
              <Text style={styles.quickLinkText}>Badges</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgFixed: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  scrim: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,14,14,0.55)' },
  container: { flex: 1 },
  // Max-width + auto margins keep desktop content centered with the photo
  // breathing on both sides, like the mockup (Yoga supports 'auto' margins).
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48, gap: 20, width: '100%', maxWidth: 1200, marginHorizontal: 'auto' },

  navBar: { width: '100%', backgroundColor: 'rgba(14,14,14,0.65)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1200, marginHorizontal: 'auto', paddingHorizontal: 24, paddingVertical: 12 },
  logo: { ...RivalType.titleMd, color: RivalColors.accentText, letterSpacing: 4, fontWeight: '800' },
  navLinks: { flexDirection: 'row', gap: 20 },
  navLink: { ...RivalType.bodyMd, fontSize: 14, color: RivalColors.textSecondary },
  navLinkActive: { color: RivalColors.textPrimary, fontWeight: '700' },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: { alignItems: 'flex-end' },
  rankBadgeLabel: { ...RivalType.labelCaps, fontSize: 9, color: RivalColors.textSecondary },
  rankBadgeValue: { fontSize: 13, fontWeight: '700' },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerAvatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: RivalColors.accentFill, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 14, fontWeight: '800', color: RivalColors.onAccentFill },

  greetingBlock: { alignItems: 'center', gap: 6, marginTop: 12 },
  greeting: { ...RivalType.headlineLg, fontSize: 36, lineHeight: 44, color: RivalColors.textPrimary },
  greetingSub: { ...RivalType.bodyMd, fontSize: 14, color: RivalColors.onSurfaceVariant, textAlign: 'center', maxWidth: 420 },

  heroCard: { alignItems: 'center', gap: 6, width: '100%', maxWidth: 660, alignSelf: 'center', paddingVertical: 28 },
  heroIcon: { fontSize: 20 },
  iconDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  addWorkoutPill: { alignSelf: 'center', paddingHorizontal: 64, borderRadius: RivalRadius.full, minWidth: 320 },
  heroLabel: { ...RivalType.labelCaps, color: RivalColors.textSecondary },
  heroValue: { ...RivalType.displayHero, color: RivalColors.accentText },
  heroSub: { ...RivalType.bodyMd, fontSize: 13, color: RivalColors.textSecondary, textAlign: 'center' },

  seasonBanner: { backgroundColor: 'rgba(20,20,20,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: RivalRadius.DEFAULT, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { fontSize: 22 },
  bannerTitle: { ...RivalType.bodyMd, fontWeight: '700', color: RivalColors.textPrimary },
  bannerSub: { fontSize: 12, color: RivalColors.textSecondary, marginTop: 2 },

  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { flex: 1, minWidth: 230, gap: 8 },
  gridCardQuarter: { flexBasis: '22%', minWidth: 0 },
  cardTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tag: { backgroundColor: `${RivalColors.accentFill}22`, borderRadius: RivalRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.accentText },
  gridCardLabel: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.textSecondary },
  gridCardTitle: { fontSize: 15, fontWeight: '700', color: RivalColors.textPrimary },
  gridCardValue: { fontSize: 26, fontWeight: '300', color: RivalColors.accentText },
  gridCardValueSub: { fontSize: 14, color: RivalColors.textSecondary },
  gridCardMeta: { fontSize: 11, color: RivalColors.textSecondary },
  gridCardBtn: { backgroundColor: RivalColors.accentFill, borderRadius: RivalRadius.full, paddingVertical: 10, alignItems: 'center', marginTop: 'auto' },
  gridCardBtnText: { color: RivalColors.onAccentFill, fontWeight: '700', fontSize: 13 },
  gridCardEmptyText: { fontSize: 13, color: RivalColors.textSecondary, lineHeight: 19 },

  streakCardCenter: { alignItems: 'center', justifyContent: 'center' },
  streakFlame: { fontSize: 24 },
  streakValue: { fontSize: 26, fontWeight: '300', color: RivalColors.textPrimary },
  pipRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  pip: { width: 22, height: 5, borderRadius: RivalRadius.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  pipActive: { backgroundColor: RivalColors.accentFill },

  momentumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 },
  momentumLogo: { width: 30, height: 30, borderRadius: 15 },
  momentumAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: RivalColors.tertiaryContainer, alignItems: 'center', justifyContent: 'center' },
  momentumAvatarText: { fontSize: 10, color: RivalColors.textPrimary, fontWeight: '700' },
  momentumName: { fontSize: 13, fontWeight: '600', color: RivalColors.textPrimary },
  momentumMeta: { fontSize: 11, color: RivalColors.accentText },
  momentumArrow: { fontSize: 14, color: RivalColors.textSecondary },
  momentumFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addTeamLink: { fontSize: 12, fontWeight: '700', color: RivalColors.accentText, paddingTop: 6 },
  teamEmptyLinks: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  teamEmptyLink: { fontSize: 12, fontWeight: '600', color: RivalColors.textSecondary },

  snapshotTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  snapshotSeeAll: { fontSize: 11, fontWeight: '700', color: RivalColors.accentText },
  snapshotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  snapshotDisc: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  snapshotIcon: { fontSize: 15 },
  snapshotValue: { fontSize: 16, fontWeight: '700', color: RivalColors.textPrimary },
  aiShareBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, marginTop: 'auto' },

  seasonWrap: { gap: 14 },
  seasonWrapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  seasonWrapTitle: { ...RivalType.labelCaps, color: RivalColors.accentText },
  seasonWrapSub: { fontSize: 13, color: RivalColors.textSecondary, marginTop: 2 },
  seasonWrapLink: { ...RivalType.labelCaps, fontSize: 11, color: RivalColors.textSecondary },
  seasonWrapRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  seasonWrapValue: { fontSize: 20, fontWeight: '600', color: RivalColors.textPrimary, marginTop: 4 },
  seasonWrapRank: { fontSize: 20, fontWeight: '800', fontStyle: 'italic', marginTop: 4, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },

  stravaCard: { backgroundColor: 'rgba(20,20,20,0.55)', borderRadius: RivalRadius.DEFAULT, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: RivalColors.outlineVariant },
  stravaCardTitle: { fontSize: 15, fontWeight: '700', color: RivalColors.textPrimary },
  stravaCardSub: { fontSize: 12, color: RivalColors.textSecondary, marginTop: 2 },
  stravaCardArrow: { fontSize: 20, color: RivalColors.accentText },
  stravaConnectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(20,20,20,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: RivalRadius.DEFAULT, paddingHorizontal: 14, paddingVertical: 12 },
  syncConnected: { color: RivalColors.tertiary, fontSize: 13, fontWeight: '600' },
  syncBtn: { color: RivalColors.tertiary, fontSize: 13, fontWeight: '700' },

  quickLinks: { flexDirection: 'row', gap: 10 },
  quickLink: { flex: 1, backgroundColor: 'rgba(20,20,20,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: RivalRadius.DEFAULT, paddingVertical: 12, alignItems: 'center' },
  quickLinkText: { color: RivalColors.textSecondary, fontSize: 13, fontWeight: '600' },
});
