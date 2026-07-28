import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform, ScrollView, Image, ImageBackground, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { fetchAllActivities } from '../lib/fetchAllActivities';
import { notify } from '../lib/notify';
import { getDailyQuote, QuoteTone } from '../lib/quotes';
import { getMondayOfWeek, calculateStreak } from '../lib/streak';
import { getCurrentSeasonYear, daysUntilSeasonEnd, getSeasonStartISO } from '../lib/season';
import { getLevel } from '../lib/xp';
import { computeGoalProgress, goalUnit, GoalRow } from '../lib/goalProgress';
import { RivalButton, RivalCard, RivalProgressBar, RivalIcon, RivalTopNav } from '../components/rival';
import { RivalColors, RivalRadius, RivalType } from '../constants/rivalTheme';

type League = { id: string; name: string; invite_code: string; logo_url: string | null; recentCount?: number };
type NextRace = { name: string; race_date: string } | null;
type WeeklyLeaderEntry = { userId: string; name: string; avatarUrl: string | null; points: number; isSelf: boolean };
type WeeklyLeader = {
  leagueId: string;
  teamName: string;
  daysRemaining: number;
  // Full ranked list (points > 0 only), so the card can tell the viewer's
  // own story even when they're not #1 — not just the top 3.
  standings: WeeklyLeaderEntry[];
};
type MomentumTrainers = { leagueId: string; names: string[]; totalCount: number; selfTrained: boolean };
type MomentumContent = { message: string; cta: string };

// The card's whole point is answering "what do I need to do to move up" —
// so the headline is always about the viewer's own rank relative to
// whoever's next, not just "who's winning." rankIcon/rankLabel picks the
// badge (crown for #1, medal for #2/#3, plain "4th" text below that).
// before/gap/after split the sentence so the gap number can be rendered at
// a different size than the surrounding words — gap is null when there's
// simply no rival yet (leading with nobody else on the board).
type RankStory = { rankIcon: 'crown' | 'medal' | null; rankLabel: string | null; before: string; gap: number | null; after: string };
// First name + last initial (e.g. "Ricky J.") — same shape as identity.ts's
// first_last_initial style, just always applied here regardless of the
// user's chosen display_style, since a leaderboard needs real names.
function weeklyLeaderName(profile: { display_name?: string | null; email?: string | null } | undefined): string {
  const raw = profile?.display_name || profile?.email?.split('@')[0] || 'Athlete';
  const parts = raw.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

// First name only — Team Momentum's "Sandy, Emma and 3 others" is a casual
// nudge from people, not a formal standing, so it skips the last-initial
// weeklyLeaderName uses for the leaderboard.
function firstNameOnly(profile: { display_name?: string | null; email?: string | null } | undefined): string {
  const raw = profile?.display_name || profile?.email?.split('@')[0] || 'Someone';
  return raw.trim().split(/\s+/)[0];
}

function weeklyRankStory(standings: WeeklyLeaderEntry[], selfIndex: number): RankStory {
  const leader = standings[0];
  if (selfIndex === 0) {
    const second = standings[1];
    return second
      ? { rankIcon: 'medal', rankLabel: null, before: 'Leading by ', gap: Math.round(leader.points - second.points), after: '' }
      : { rankIcon: 'medal', rankLabel: null, before: "You're leading", gap: null, after: '' };
  }
  if (selfIndex === 1) {
    const gap = Math.round(leader.points - standings[1].points);
    return { rankIcon: 'medal', rankLabel: null, before: '', gap, after: ` behind ${leader.name}` };
  }
  if (selfIndex === 2) {
    const gap = Math.round(leader.points - standings[2].points);
    return { rankIcon: 'medal', rankLabel: null, before: '', gap, after: ' from first' };
  }
  const podiumCutoff = standings[2] || leader;
  const gap = Math.round(podiumCutoff.points - standings[selfIndex].points);
  return { rankIcon: null, rankLabel: `${selfIndex + 1}th`, before: '', gap, after: ' to reach the podium' };
}
// Team Momentum's status line — reuses the same weeklyLeader standings the
// Weekly Leader card computes for this same team (leagues[0], the most
// active one) instead of firing a second query. Priority: leading is the
// most exciting thing that can be true, a specific gap is more motivating
// than a headcount, and named teammates ("Sandy, Emma and 3 others") pull
// harder than a raw count when you're not on the board yet. The "haven't
// trained" case is framed as an invite ("Join them"), never a callout —
// AGENTS.md's voice rule is encourage, never pressure or shame.
function momentumStory(trainers: MomentumTrainers | null, weeklyLeader: WeeklyLeader | null, leagueId: string): MomentumContent {
  if (weeklyLeader && weeklyLeader.leagueId === leagueId && weeklyLeader.standings.length > 0) {
    const selfIndex = weeklyLeader.standings.findIndex((e) => e.isSelf);
    if (selfIndex === 0) return { message: "You're leading this week — keep it going", cta: 'View Team' };
    if (selfIndex > 0) {
      const gap = Math.round(weeklyLeader.standings[0].points - weeklyLeader.standings[selfIndex].points);
      return { message: `${gap} Effort behind the lead`, cta: 'Jump back in' };
    }
  }
  if (trainers && trainers.leagueId === leagueId && trainers.names.length > 0) {
    const { names, totalCount } = trainers;
    const list =
      totalCount === 1
        ? names[0]
        : totalCount === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, 2).join(', ')} and ${totalCount - 2} ${totalCount - 2 === 1 ? 'other' : 'others'}`;
    if (trainers.selfTrained) return { message: `${list} trained today too — nice work`, cta: 'Jump back in' };
    return { message: `${list} trained today`, cta: 'Join them' };
  }
  return { message: "Nobody's trained yet this week", cta: 'Be the First' };
}
type FeaturedGoal = {
  id: string;
  title: string;
  progress: number;
  target: number;
  unit: string;
  pct: number;
  daysLeft: number;
};

function todayLocalStr(): string {
  return dateLocalStr(new Date());
}

function dateLocalStr(d: Date): string {
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

// Scales the hero number down as it gets longer so "186h 10m" still fits on
// one line at hero scale, instead of wrapping onto a stacked second line
// (looked broken, not "impressive," on a real account's accumulated total).
// "Run · Distance" reads as metadata, not something someone chose — the
// Today card's title leads with the actual target instead (e.g. "100 km
// Run"), goalProgress.ts's goalTitle() stays as-is for goals.tsx's own list
// (badge + label already covers the type there, so it doesn't need this).
function featuredGoalTitle(goal: { goal_type: 'distance' | 'elevation' | 'gym_sessions'; activity_filter: string | null; target_value: number }): string {
  if (goal.goal_type === 'gym_sessions') return `Gym Sessions • ${goal.target_value}`;
  const unit = goalUnit(goal.goal_type);
  const activity = goal.activity_filter ?? 'All Activities';
  return `${activity} • ${goal.target_value} ${unit}`;
}

// Staged copy by raw progress (not time-based pace — see the "single 80km
// session" conversation: this only ever claims "how much is left," never
// anything about being ahead/behind schedule).
function focusProgressPhrase(pct: number): string {
  if (pct >= 1) return 'YOU EARNED THIS';
  if (pct >= 0.9) return 'So close';
  if (pct >= 0.65) return 'Stay focused';
  if (pct >= 0.5) return "You're over halfway";
  if (pct >= 0.3) return 'Keep showing up';
  return "Let's do this";
}

function heroValueFontSize(text: string): number {
  if (text.length <= 4) return 132;
  if (text.length <= 6) return 114;
  if (text.length <= 8) return 94;
  if (text.length <= 10) return 76;
  return 60;
}

// Same dead-space lesson as heroValueFontSize, applied to the other side of
// this problem: a name is unbounded ("Sam Lee" vs "Maximilian von
// Hohenberg-Smith"), so fixed wide tracking that looks great on a short name
// turns unwieldy or wraps badly on a long one. Tightens automatically as
// names get longer instead of needing a per-user retune — the current
// name's own length (<=22, e.g. "Ricky Jackson-Lewis") keeps the exact
// current look (14.5, the 0.5em ratio), only longer names taper further.
function greetingLetterSpacing(name: string): number {
  if (name.length <= 22) return 14.5;
  if (name.length <= 30) return 9.41;
  if (name.length <= 40) return 5.88;
  return 3.53;
}


export default function HomeScreen() {
  const [displayName, setDisplayName] = useState('');
  const [stravaConnected, setStravaConnected] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [weeklyLeader, setWeeklyLeader] = useState<WeeklyLeader | null>(null);
  const [momentumTrainers, setMomentumTrainers] = useState<MomentumTrainers | null>(null);
  const [nextRace, setNextRace] = useState<NextRace>(null);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [totalElevationM, setTotalElevationM] = useState(0);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(0);
  // Lifetime effort/activity counts — kept separate from totalXp (season-
  // scoped, drives getLevel()) so the LEGACY card's four numbers are all the
  // same timeframe without changing what powers the user's rank.
  const [lifetimeXp, setLifetimeXp] = useState(0);
  const [lifetimeActivityCount, setLifetimeActivityCount] = useState(0);
  const [weeklyStreak, setWeeklyStreak] = useState(0);
  const [rankName, setRankName] = useState<string | null>(null);
  const [featuredGoal, setFeaturedGoal] = useState<FeaturedGoal | null>(null);
  const [goalsCardHovered, setGoalsCardHovered] = useState(false);
  const [leaderCardHovered, setLeaderCardHovered] = useState(false);
  const [momentumCardHovered, setMomentumCardHovered] = useState(false);
  const [statsCardHovered, setStatsCardHovered] = useState(false);
  const [addActivityHovered, setAddActivityHovered] = useState(false);
  const [quote, setQuote] = useState(() => getDailyQuote());
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
    const [stravaRes, activitiesRes, leaguesRes, raceRes, userProfileRes, goalsRes] = await Promise.all([
      supabase.from('fitness_connections').select('user_id').eq('user_id', uId).eq('provider', 'strava').maybeSingle(),
      fetchAllActivities(uId, 'id, started_at, effort_score, distance_meters, elevation_meters, activity_type, duration_seconds'),
      supabase.from('league_members').select('league_id, leagues(id, name, invite_code, logo_url)').eq('user_id', uId).eq('status', 'active'),
      supabase.from('races').select('name, race_date').eq('user_id', uId).gte('race_date', today).order('race_date', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('users').select('avatar_url, quote_tone').eq('id', uId).single(),
      supabase.from('goals').select('*').eq('user_id', uId),
    ]);

    setStravaConnected(!!stravaRes.data);
    setNextRace(raceRes.data ?? null);
    const myAvatarUrl: string | null = userProfileRes.data?.avatar_url || null;
    setAvatarUrl(myAvatarUrl);
    const savedTone = userProfileRes.data?.quote_tone as QuoteTone | undefined;
    if (savedTone && savedTone !== 'balanced') setQuote(getDailyQuote(savedTone));

    const leagueList = leaguesRes.data?.map((m: any) => m.leagues).filter(Boolean) ?? [];
    setLeagues(leagueList);
    const leagueIds = leaguesRes.data?.map((m: any) => m.league_id) ?? [];

    const activities = activitiesRes;
    setTotalDistanceKm(Math.round(activities.reduce((s, a) => s + (a.distance_meters || 0), 0) / 1000));
    setTotalElevationM(Math.round(activities.reduce((s, a) => s + (a.elevation_meters || 0), 0)));
    setTotalTimeMinutes(Math.round(activities.reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60));
    setLifetimeXp(activities.reduce((s, a) => s + (a.effort_score || 0), 0));
    setLifetimeActivityCount(activities.length);
    setWeeklyStreak(calculateStreak(activities).current);

    // Rank = level from this season's Effort — same definition the nav bar uses.
    const seasonStart = new Date(getSeasonStartISO());
    const seasonEffort = activities.filter(a => new Date(a.started_at) >= seasonStart).reduce((s, a) => s + (a.effort_score || 0), 0);
    setRankName(getLevel(seasonEffort).name);

    // Featured goal: the ACTIVE goal nearest its deadline (tie-break: most
    // complete). One goal on the dashboard, deliberately — Ricky's call:
    // showing several dilutes focus; the card links to /goals for the rest.
    const now = new Date();
    type GoalRowFull = GoalRow & { id: string; target_value: number; period_type: 'week' | 'month' | 'custom'; pinned?: boolean };
    const allGoals = (goalsRes.data ?? []) as GoalRowFull[];
    const activeGoals = allGoals
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
      // Pinned goal wins outright, ahead of the nearest-deadline sort —
      // that sort is only the fallback for when nothing's been pinned.
      .sort((a, b) => (b.goal.pinned ? 1 : 0) - (a.goal.pinned ? 1 : 0) || a.endMs - b.endMs || b.pct - a.pct);
    if (activeGoals.length > 0) {
      const top = activeGoals[0];
      setFeaturedGoal({
        id: top.goal.id,
        title: featuredGoalTitle(top.goal),
        progress: top.progress,
        target: top.goal.target_value,
        unit: goalUnit(top.goal.goal_type),
        pct: top.pct,
        daysLeft: Math.max(0, Math.ceil((top.endMs - now.getTime()) / (1000 * 60 * 60 * 24))),
      });
    } else {
      // No active goal — the "ended, not hit" encouragement + Try Again
      // action lives only on the Goals page (goals.tsx's isGoalEnded/
      // endedMessage), not here. Today's card just invites setting a new
      // one either way.
      setFeaturedGoal(null);
    }

    // Per-league "new activity" teaser count — powers the Team Pulse card.
    // Local calendar-day boundary (midnight in the viewer's own device
    // timezone), not a rolling 24h window — a rolling window still calls
    // yesterday-afternoon's workout "today" if it's under 24h old, which is
    // exactly the mismatch a rolling window can't avoid. This runs
    // client-side so it's automatically each viewer's own "today", no
    // matter what country they're in.
    if (leagueIds.length > 0) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

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
        .select('user_id, started_at')
        .in('user_id', allMemberIds)
        .gte('started_at', startOfToday.toISOString())
        .order('started_at', { ascending: false });

      const leagueListWithCounts = leagueList.map((l: League) => {
        const memberIds = new Set(memberIdsByLeague[l.id] || []);
        const count = (recentActivities || []).filter((a: any) => a.user_id !== uId && memberIds.has(a.user_id)).length;
        return { ...l, recentCount: count };
      });
      // Most-active teams first — Momentum is "who's training right now", and
      // only the top few show by default (mockup keeps this card compact).
      leagueListWithCounts.sort((a: League, b: League) => (b.recentCount ?? 0) - (a.recentCount ?? 0));
      setLeagues(leagueListWithCounts);

      // Who's actually moved, not just how many — "Sandy, Emma and 3 others"
      // reads as a nudge from people, not a stat. Most-recent-first, dedup'd,
      // for the same top team the rest of Momentum/Weekly Leader focus on.
      const hotLeague = leagueListWithCounts[0];
      const hotMemberIds = new Set(memberIdsByLeague[hotLeague.id] || []);
      const trainerIds: string[] = [];
      let selfTrained = false;
      (recentActivities || []).forEach((a: any) => {
        if (a.user_id === uId) { selfTrained = true; return; }
        if (hotMemberIds.has(a.user_id) && !trainerIds.includes(a.user_id)) {
          trainerIds.push(a.user_id);
        }
      });
      if (trainerIds.length > 0) {
        const { data: trainerProfiles } = await supabase
          .from('users')
          .select('id, display_name, email')
          .in('id', trainerIds);
        const trainerProfileById: Record<string, any> = {};
        (trainerProfiles || []).forEach((p: any) => { trainerProfileById[p.id] = p; });
        const names = trainerIds.map((id) => firstNameOnly(trainerProfileById[id]));
        setMomentumTrainers({ leagueId: hotLeague.id, names, totalCount: trainerIds.length, selfTrained });
      } else {
        setMomentumTrainers(null);
      }

      // Weekly Leader: standings for your most-active team, this calendar
      // week (Monday-start, same boundary streak.ts uses). A single big
      // session can't win the whole day-to-day this way — it has to hold up
      // over the week, and laggards can see exactly how much Effort they
      // need to catch the leader instead of just "some number."
      const pulseLeague = leagueListWithCounts[0];
      const pulseMemberIds = memberIdsByLeague[pulseLeague.id] || [];
      if (pulseMemberIds.length > 0) {
        const weekStart = getMondayOfWeek(new Date());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const daysRemaining = Math.max(0, Math.ceil((weekEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        const { data: weekActivities } = await supabase
          .from('activities')
          .select('user_id, effort_score')
          .in('user_id', pulseMemberIds)
          .gte('started_at', weekStart.toISOString());

        const pointsByUser: Record<string, number> = {};
        (weekActivities || []).forEach((a: any) => {
          pointsByUser[a.user_id] = (pointsByUser[a.user_id] || 0) + (a.effort_score || 0);
        });

        // Full ranked list (not just the podium) — the viewer's own rank
        // might be 4th+, and the card still needs to tell that story.
        const rankedIds = Object.keys(pointsByUser)
          .filter((id) => pointsByUser[id] > 0)
          .sort((a, b) => pointsByUser[b] - pointsByUser[a]);

        if (rankedIds.length > 0) {
          const { data: profiles } = await supabase
            .from('users')
            .select('id, display_name, avatar_url, email')
            .in('id', rankedIds);
          const profileById: Record<string, any> = {};
          (profiles || []).forEach((p: any) => { profileById[p.id] = p; });

          // First name + last initial always, regardless of the user's
          // chosen display style (e.g. username_only) — a leaderboard reads
          // better with names than handles, unlike league.tsx's member list
          // which respects that preference.
          const standings: WeeklyLeaderEntry[] = rankedIds.map((id) => ({
            userId: id,
            name: weeklyLeaderName(profileById[id]),
            avatarUrl: profileById[id]?.avatar_url || null,
            points: Math.round(pointsByUser[id]),
            isSelf: id === uId,
          }));

          setWeeklyLeader({ leagueId: pulseLeague.id, teamName: pulseLeague.name, daysRemaining, standings });
        } else {
          setWeeklyLeader(null);
        }
      } else {
        setWeeklyLeader(null);
      }
    } else {
      setWeeklyLeader(null);
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

  // The mockup's 4-card row must stay 4-across on desktop — explicit quarter
  // widths above the breakpoint, natural wrapping (2-up/stacked) below it.
  const { width: windowWidth } = useWindowDimensions();
  const fourUp = windowWidth >= 840;
  const gridCardStyle = fourUp ? [styles.gridCard, styles.gridCardQuarter] : styles.gridCard;
  const days = nextRace ? daysUntil(nextRace.race_date) : null;
  const seasonYear = getCurrentSeasonYear();
  const seasonDaysLeft = daysUntilSeasonEnd();
  const heroHours = Math.floor(totalTimeMinutes / 60);
  const heroMins = totalTimeMinutes % 60;
  const heroTimeText = `${heroHours > 0 ? `${heroHours}h ` : ''}${heroMins}m`;

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
        <RivalTopNav active="today" />

        <ScrollView contentContainerStyle={styles.content}>

          {/* Greeting */}
          <View style={styles.greetingBlock}>
            <Text style={[styles.greeting, { letterSpacing: greetingLetterSpacing(displayName) }]}>{displayName}</Text>
            <Text style={styles.greetingSub}>{quote.text}</Text>
          </View>

          {/* Hero: Total Time Earned — narrower + centered like the mockup */}
          <RivalCard glass style={styles.heroCard}>
            <Text style={[styles.heroLabel, { marginBottom: 4 }]}>TOTAL TIME EARNED</Text>
            <Text
              style={[styles.heroValue, { fontSize: heroValueFontSize(heroTimeText), lineHeight: heroValueFontSize(heroTimeText) * 1.1 }]}
              numberOfLines={1}
            >
              {heroHours > 0 && (
                <>
                  {heroHours}
                  <Text style={[styles.heroValueUnit, { fontSize: heroValueFontSize(heroTimeText) * 0.42 }]}>h</Text>
                  {' '}
                </>
              )}
              {heroMins}
              <Text style={[styles.heroValueUnit, { fontSize: heroValueFontSize(heroTimeText) * 0.42 }]}>m</Text>
            </Text>
            <View style={{ marginTop: -10, alignItems: 'center' }}>
              <Text style={styles.heroSub}>Every minute in here is yours.</Text>
              <Text style={styles.heroSub}>You earned it.</Text>
            </View>
          </RivalCard>

          <RivalButton
            label="Add Activity"
            onPress={() => router.push('/add-workout')}
            style={[styles.addWorkoutPill, addActivityHovered && styles.gridCardHovered]}
            {...(Platform.OS === 'web'
              ? { onMouseEnter: () => setAddActivityHovered(true), onMouseLeave: () => setAddActivityHovered(false) }
              : {})}
          />

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

            {/* Featured goal — nearest deadline; card named after the goal itself.
                Empty state (no active goal — an ended-but-unhit one is only
                surfaced with its own "Try Again" flow on the Goals page, not
                here) becomes one big glass button — nothing to review yet,
                just an invite to set one — with the same hover "pop" as the
                team crest cards. */}
            {(() => {
              const goalsEmpty = !featuredGoal;
              return (
                <TouchableOpacity
                  activeOpacity={goalsEmpty ? 0.85 : 1}
                  disabled={!goalsEmpty}
                  onPress={() => router.push('/goals')}
                  style={gridCardStyle}
                  {...(Platform.OS === 'web'
                    ? { onMouseEnter: () => setGoalsCardHovered(true), onMouseLeave: () => setGoalsCardHovered(false) } as any
                    : {})}
                >
                  <RivalCard
                    glass
                    style={[
                      { flex: 1 },
                      goalsCardHovered && styles.gridCardHovered,
                      // Border-brighten scoped to just this card, not the
                      // shared gridCardHovered (also used by the Add Activity
                      // button, which has no border to brighten).
                      goalsCardHovered && { borderColor: 'rgba(255,255,255,0.22)' },
                    ]}
                  >
                    {featuredGoal ? (
                      // Same shape as the empty state below: small tracked
                      // "FOCUS" label, the goal itself as the hero content
                      // (title + real progress/bar, not a generic countdown),
                      // then a minimal text link at the bottom instead of a
                      // filled pill — consistent visual weight either way.
                      <View style={{ flex: 1, paddingBottom: 24 }}>
                        {/* Group 1: what is it — anchored to the top, its own
                            block so it can move independently of group 2. */}
                        <View style={styles.focusActiveTopGroup}>
                          <Text style={styles.focusLabel}>FOCUS</Text>
                          <Text style={[styles.focusGoalTitle, styles.focusActiveTitleGap]}>{featuredGoal.title}</Text>
                        </View>

                        {/* Spacer above group 2 too — slightly smaller than
                            the one below (0.8 vs 1) so this block sits a
                            touch above dead-center rather than perfectly
                            centered in the space between the top group and
                            the CTA. */}
                        <View style={{ flex: 0.8 }} />

                        {/* Group 2: how am I doing — clustered tight, own block */}
                        <View style={styles.focusActiveMidGroup}>
                          <Text style={styles.gridCardValue}>
                            {featuredGoal.progress.toLocaleString()}
                            <Text style={[styles.gridCardValueSub, { color: RivalColors.textPrimary }]}> / {featuredGoal.target.toLocaleString()} {featuredGoal.unit}</Text>
                          </Text>
                          <View style={[styles.focusProgressBarWrap, styles.focusActiveBarGap]}>
                            <RivalProgressBar pct={featuredGoal.pct} height={10} />
                            <Text style={styles.focusProgressPctOnBar}>{Math.round(featuredGoal.pct * 100)}%</Text>
                          </View>
                          <Text style={[styles.gridCardMeta, styles.focusActiveMetaGap, { color: RivalColors.textPrimary }]} numberOfLines={2}>
                            {focusProgressPhrase(featuredGoal.pct)}
                            {'  •  '}
                            <Text style={{ color: RivalColors.accentText }}>
                              {featuredGoal.daysLeft === 0 ? 'Last day' : `${featuredGoal.daysLeft} day${featuredGoal.daysLeft === 1 ? '' : 's'} left`}
                            </Text>
                          </Text>
                        </View>

                        {/* Flexible spacer — pins group 3 to the bottom of
                            the card regardless of how groups 1/2 are positioned. */}
                        <View style={{ flex: 1 }} />

                        {/* Group 3: what next — same hover treatment as the
                            empty state's "Set Focus →" link. */}
                        <View style={[styles.focusEmptyLinkRow, styles.focusEmptyLinkBottom]}>
                          <TouchableOpacity onPress={() => router.push('/goals')}>
                            <Text
                              style={[
                                styles.focusEmptyLink,
                                goalsCardHovered && { color: RivalColors.textPrimary },
                                Platform.OS === 'web' ? ({ transition: 'color 0.2s ease' } as any) : {},
                              ]}
                            >
                              View Focus
                            </Text>
                          </TouchableOpacity>
                          <Text
                            style={[
                              styles.focusEmptyLink,
                              goalsCardHovered && { color: RivalColors.textPrimary, transform: [{ translateX: 3 }] },
                              Platform.OS === 'web' ? ({ transition: 'color 0.2s ease, transform 0.2s ease' } as any) : {},
                            ]}
                          >
                            {' '}→
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flex: 1, paddingBottom: 24 }}>
                        <View style={styles.goalsEmptyCentered}>
                          <Text style={styles.focusLabel}>FOCUS</Text>
                          <Text style={styles.goalsEmptyTitle}>Choose something worth chasing.</Text>
                        </View>
                        <View style={[styles.focusEmptyLinkRow, styles.focusEmptyLinkBottom]}>
                          <Text
                            style={[
                              styles.focusEmptyLink,
                              goalsCardHovered && { color: RivalColors.textPrimary },
                              Platform.OS === 'web' ? ({ transition: 'color 0.2s ease' } as any) : {},
                            ]}
                          >
                            Set Focus
                          </Text>
                          <Text
                            style={[
                              styles.focusEmptyLink,
                              goalsCardHovered && { color: RivalColors.textPrimary, transform: [{ translateX: 3 }] },
                              Platform.OS === 'web' ? ({ transition: 'color 0.2s ease, transform 0.2s ease' } as any) : {},
                            ]}
                          >
                            {' '}→
                          </Text>
                        </View>
                      </View>
                    )}
                  </RivalCard>
                </TouchableOpacity>
              );
            })()}

            {/* Weekly Leader — same top-anchored label+title anatomy as the
                Focus card, but the middle group is the standing leader and
                the bottom holds a compact 2nd/3rd podium (shown as "how far
                behind the leader", not raw totals — the gap is what makes
                catching up feel possible) plus a link to full standings. */}
            <View
              style={gridCardStyle}
              {...(Platform.OS === 'web'
                ? { onMouseEnter: () => setLeaderCardHovered(true), onMouseLeave: () => setLeaderCardHovered(false) } as any
                : {})}
            >
            <RivalCard
              glass
              style={[
                { flex: 1 },
                leaderCardHovered && styles.gridCardHovered,
                leaderCardHovered && { borderColor: 'rgba(255,255,255,0.22)' },
              ]}
            >
              {weeklyLeader ? (() => {
                const { standings } = weeklyLeader;
                const selfIndex = standings.findIndex((e) => e.isSelf);
                const endsLabel = weeklyLeader.daysRemaining === 0 ? 'Last day' : weeklyLeader.daysRemaining === 1 ? 'Ends tomorrow' : `${weeklyLeader.daysRemaining} days remaining`;

                // Not on the board yet (0 Effort this week) — no rank to
                // brag or worry about, just who to catch and by how much.
                // Same anatomy as the no-leader-at-all empty state (label,
                // medal, big title, accent subtitle, link) instead of a
                // plain paragraph — the leader already exists here, so the
                // medal is a muted textSecondary, not gold, since it's not
                // your achievement yet.
                if (selfIndex === -1) {
                  const leader = standings[0];
                  return (
                    <View style={{ flex: 1, paddingBottom: 24 }}>
                      <View style={styles.focusActiveTopGroup}>
                        <Text style={styles.focusLabel}>WEEKLY LEADER</Text>
                      </View>

                      {/* Fixed-offset block, not flex-sandwiched — the icon
                          and title's position no longer depends on how many
                          lines the subtitle below wraps to. Only the flex:1
                          spacer after the subtitle absorbs that variance. */}
                      <View style={[styles.focusActiveMidGroup, { marginTop: 56 }]}>
                        <View style={styles.medalRing}>
                          <RivalIcon name="medal" size={30} color={RivalColors.textSecondary} />
                        </View>
                        <Text style={[styles.leaderEmptyTitle, { marginTop: 10, textTransform: 'uppercase' }]} numberOfLines={1}>
                          {leader.name} leads
                        </Text>
                      </View>
                      <Text style={styles.leaderEmptySub} numberOfLines={2}>
                        <Text
                          style={[
                            styles.pulseStoryNumber,
                            { color: RivalColors.textPrimary },
                            Platform.OS === 'web' ? ({ position: 'relative', top: 1.5 } as any) : {},
                          ]}
                        >
                          {leader.points}
                        </Text>{' '}
                        Effort — can you catch them?
                      </Text>

                      <View style={{ flex: 1 }} />

                      <View style={[styles.focusEmptyLinkRow, styles.focusEmptyLinkBottom]}>
                        <TouchableOpacity onPress={() => router.push({ pathname: '/league', params: { id: weeklyLeader.leagueId } })}>
                          <Text
                            style={[
                              styles.focusEmptyLink,
                              leaderCardHovered && { color: RivalColors.textPrimary },
                              Platform.OS === 'web' ? ({ transition: 'color 0.2s ease' } as any) : {},
                            ]}
                          >
                            View Leaderboard
                          </Text>
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.focusEmptyLink,
                            leaderCardHovered && { color: RivalColors.textPrimary, transform: [{ translateX: 3 }] },
                            Platform.OS === 'web' ? ({ transition: 'color 0.2s ease, transform 0.2s ease' } as any) : {},
                          ]}
                        >
                          {' '}→
                        </Text>
                      </View>
                    </View>
                  );
                }

                const story = weeklyRankStory(standings, selfIndex);
                const selfPoints = standings[selfIndex].points;
                const podium = standings.slice(0, 3);

                return (
                  <View style={{ flex: 1, paddingBottom: 24 }}>
                    <View style={styles.focusActiveTopGroup}>
                      <Text style={styles.focusLabel}>WEEKLY LEADER</Text>
                      <View style={[styles.pulseNameRow, styles.focusActiveTitleGap, styles.pulseMedalNudgeDown]}>
                        {story.rankIcon ? (
                          <RivalIcon
                            name={story.rankIcon}
                            size={19}
                            color={selfIndex === 0 ? RivalColors.accentText : RivalColors.textSecondary}
                          />
                        ) : (
                          <Text style={styles.podiumRank}>{story.rankLabel}</Text>
                        )}
                      </View>
                    </View>

                    <View style={{ flex: 0.8 }} />

                    <View style={styles.focusActiveMidGroup}>
                      <Text style={[styles.gridCardValue, styles.pulseValueShrink, styles.pulseValueNudgeUp, { color: RivalColors.textPrimary }]}>
                        {selfPoints}
                        <Text style={[styles.gridCardValueSub, { color: RivalColors.textPrimary }]}> Effort</Text>
                      </Text>
                      <Text style={[styles.gridCardMeta, styles.pulseStoryMessage]} numberOfLines={2}>
                        {story.before}
                        {story.gap !== null && <Text style={styles.pulseStoryNumber}>{story.gap}</Text>}
                        {story.after}
                      </Text>
                      <Text style={styles.gridCardMeta} numberOfLines={1}>
                        {weeklyLeader.teamName}
                      </Text>
                    </View>

                    <View style={styles.podiumWrap}>
                      {podium.map((entry, i) => (
                        <View key={entry.userId} style={styles.podiumRow}>
                          <RivalIcon
                            name={i === 0 ? 'crown' : 'medal'}
                            size={i === 0 ? 15 : 12}
                            color={i === 0 ? '#ECC654' : i === 1 ? '#C0C0C0' : '#CD7F32'}
                          />
                          <Text
                            style={[styles.podiumName, i === 0 && styles.podiumNameFirst, entry.isSelf && styles.podiumNameSelf]}
                            numberOfLines={1}
                          >
                            {entry.name}
                          </Text>
                          <Text style={[styles.podiumGap, entry.isSelf && styles.podiumGapSelf, i === 0 && styles.podiumGapFirst]}>
                            {entry.points}
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.podiumFooterMeta}>{endsLabel}</Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    <View style={[styles.focusEmptyLinkRow, styles.focusEmptyLinkBottom]}>
                      <TouchableOpacity onPress={() => router.push({ pathname: '/league', params: { id: weeklyLeader.leagueId } })}>
                        <Text
                          style={[
                            styles.focusEmptyLink,
                            leaderCardHovered && { color: RivalColors.textPrimary },
                            Platform.OS === 'web' ? ({ transition: 'color 0.2s ease' } as any) : {},
                          ]}
                        >
                          View Leaderboard
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.focusEmptyLink,
                          leaderCardHovered && { color: RivalColors.textPrimary, transform: [{ translateX: 3 }] },
                          Platform.OS === 'web' ? ({ transition: 'color 0.2s ease, transform 0.2s ease' } as any) : {},
                        ]}
                      >
                        {' '}→
                      </Text>
                    </View>
                  </View>
                );
              })() : (
                <View style={{ flex: 1, paddingBottom: 24 }}>
                  <View style={styles.focusActiveTopGroup}>
                    <Text style={styles.focusLabel}>WEEKLY LEADER</Text>
                  </View>

                  {/* Fixed-offset block — see the selfIndex === -1 branch
                      above for why this doesn't use flex-sandwiched spacers. */}
                  <View style={[styles.focusActiveMidGroup, { marginTop: 56 }]}>
                    <View style={styles.medalRing}>
                      <RivalIcon name="medal" size={30} color="#ECC654" />
                    </View>
                    <Text style={[styles.leaderEmptyTitle, { marginTop: 10 }]} numberOfLines={1}>LEAD THIS WEEK</Text>
                  </View>
                  <Text style={styles.leaderEmptySub} numberOfLines={2}>
                    Earn the first Effort
                  </Text>

                  <View style={{ flex: 1 }} />

                  <View style={[styles.focusEmptyLinkRow, styles.focusEmptyLinkBottom]}>
                    <TouchableOpacity onPress={() => router.push('/add-workout')}>
                      <Text
                        style={[
                          styles.focusEmptyLink,
                          leaderCardHovered && { color: RivalColors.textPrimary },
                          Platform.OS === 'web' ? ({ transition: 'color 0.2s ease' } as any) : {},
                        ]}
                      >
                        Claim the Lead
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.focusEmptyLink,
                        leaderCardHovered && { color: RivalColors.textPrimary, transform: [{ translateX: 3 }] },
                        Platform.OS === 'web' ? ({ transition: 'color 0.2s ease, transform 0.2s ease' } as any) : {},
                      ]}
                    >
                      {' '}→
                    </Text>
                  </View>
                </View>
              )}
            </RivalCard>
            </View>

            {/* Team Momentum — same anatomy as Focus/Weekly Leader: a single
                team (the most active one) instead of a flat directory, since
                the Teams tab already covers "browse all your teams." The
                status line reuses weeklyLeader's standings for this same
                team when available, so it doesn't fire a second query. */}
            <View
              style={gridCardStyle}
              {...(Platform.OS === 'web'
                ? { onMouseEnter: () => setMomentumCardHovered(true), onMouseLeave: () => setMomentumCardHovered(false) } as any
                : {})}
            >
            <RivalCard
              glass
              style={[
                { flex: 1 },
                momentumCardHovered && styles.gridCardHovered,
                momentumCardHovered && { borderColor: 'rgba(255,255,255,0.22)' },
              ]}
            >
              {leagues.length === 0 ? (
                <View style={{ flex: 1, paddingBottom: 24 }}>
                  <View style={styles.focusActiveTopGroup}>
                    <Text style={styles.focusLabel}>TEAM PULSE</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <View style={styles.goalsEmptyCentered}>
                    <Text style={styles.goalsEmptyTitle}>Training is better together.</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.focusEmptyLinkRow, styles.focusEmptyLinkBottom]}>
                    <TouchableOpacity onPress={() => router.push('/create-league')}>
                      <Text style={styles.focusEmptyLink}>Create Your Team</Text>
                    </TouchableOpacity>
                    <Text style={styles.focusEmptyLink}> →</Text>
                  </View>
                </View>
              ) : (() => {
                const hotTeam = leagues[0];
                const story = momentumStory(momentumTrainers, weeklyLeader, hotTeam.id);

                return (
                  <View style={{ flex: 1, paddingBottom: 24 }}>
                    <View style={styles.focusActiveTopGroup}>
                      <Text style={styles.focusLabel}>TEAM PULSE</Text>
                    </View>

                    {/* Fixed-offset block — see Weekly Leader's selfIndex
                        === -1 branch for why this doesn't use flex-
                        sandwiched spacers. Crest/name position is now
                        independent of how long the story line rolls. */}
                    <View style={[styles.focusActiveMidGroup, { marginTop: 56 }]}>
                      {hotTeam.logo_url ? (
                        <Image source={{ uri: hotTeam.logo_url }} style={styles.momentumHeroLogo} />
                      ) : (
                        <View style={styles.momentumHeroAvatar}>
                          <Text style={styles.momentumAvatarText}>{hotTeam.name.slice(0, 2).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={[styles.leaderEmptyTitle, { marginTop: 10, textTransform: 'uppercase' }]} numberOfLines={1}>{hotTeam.name}</Text>
                    </View>
                    <Text style={styles.leaderEmptySub} numberOfLines={2}>{story.message}</Text>

                    <View style={{ flex: 1 }} />

                    <View style={[styles.focusEmptyLinkRow, styles.focusEmptyLinkBottom]}>
                      <TouchableOpacity onPress={() => router.push({ pathname: '/league', params: { id: hotTeam.id } })}>
                        <Text
                          style={[
                            styles.focusEmptyLink,
                            momentumCardHovered && { color: RivalColors.textPrimary },
                            Platform.OS === 'web' ? ({ transition: 'color 0.2s ease' } as any) : {},
                          ]}
                        >
                          {story.cta}
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.focusEmptyLink,
                          momentumCardHovered && { color: RivalColors.textPrimary, transform: [{ translateX: 3 }] },
                          Platform.OS === 'web' ? ({ transition: 'color 0.2s ease, transform 0.2s ease' } as any) : {},
                        ]}
                      >
                        {' '}→
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </RivalCard>
            </View>

            {/* Stats Snapshot */}
            <View
              style={gridCardStyle}
              {...(Platform.OS === 'web'
                ? { onMouseEnter: () => setStatsCardHovered(true), onMouseLeave: () => setStatsCardHovered(false) } as any
                : {})}
            >
              <RivalCard
                glass
                style={[
                  { flex: 1, position: 'relative', overflow: 'hidden' },
                  statsCardHovered && styles.gridCardHovered,
                  statsCardHovered && { borderColor: 'rgba(255,255,255,0.22)' },
                ]}
              >
                <View
                  style={[
                    statsCardHovered && Platform.OS === 'web' ? ({ filter: 'blur(4px)', transition: 'filter 0.2s ease' } as any) : (Platform.OS === 'web' ? ({ transition: 'filter 0.2s ease' } as any) : {}),
                  ]}
                >
                  <TouchableOpacity onPress={() => router.push('/stats')}>
                    <Text style={[styles.focusLabel, { textAlign: 'center' }]}>LEGACY</Text>
                    <Text style={[styles.focusGoalTitle, styles.focusActiveTitleGap, { textAlign: 'center' }]}>Everything you've Earned</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1, justifyContent: 'center', gap: 10, marginTop: 11 }}>
                    <TouchableOpacity style={styles.snapshotRow} onPress={() => router.push('/stats')}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.snapshotHeroValue, styles.snapshotHeroValueLead]}>{Math.round(lifetimeXp).toLocaleString()}</Text>
                        <Text style={styles.gridCardLabel}>EFFORT</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.snapshotDivider} />
                    <TouchableOpacity style={[styles.snapshotRow, { marginTop: 16 }]} onPress={() => router.push('/stats')}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.snapshotHeroValue}>{totalDistanceKm.toLocaleString()}</Text>
                        <Text style={styles.gridCardLabel}>DISTANCE</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.snapshotRow} onPress={() => router.push('/stats')}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.snapshotHeroValue}>{totalElevationM.toLocaleString()}</Text>
                        <Text style={styles.gridCardLabel}>CLIMBED</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.snapshotRow} onPress={() => router.push('/my-activities')}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.snapshotHeroValue}>{lifetimeActivityCount.toLocaleString()}</Text>
                        <Text style={styles.gridCardLabel}>ACTIVITIES</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
                {statsCardHovered && Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={styles.snapshotHoverOverlay}
                    onPress={() => router.push('/stats')}
                  >
                    <Text style={[styles.focusEmptyLink, { color: RivalColors.textPrimary }]}>View all →</Text>
                  </TouchableOpacity>
                )}
              </RivalCard>
            </View>
          </View>

          {/* Momentum strip */}
          <RivalCard glass style={styles.seasonWrap}>
            <View style={styles.seasonWrapRow}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.gridCardLabel}>NEXT RACE</Text>
                {days !== null ? (
                  <TouchableOpacity onPress={() => router.push('/races')}>
                    <Text style={styles.seasonWrapValue}>{days} Days</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.addRaceBtn} onPress={() => router.push('/races?add=true')}>
                    <RivalIcon name="add" size={13} color={RivalColors.accentText} />
                    <Text style={styles.addRaceBtnText}>Add Race</Text>
                  </TouchableOpacity>
                )}
              </View>
              {rankName && (
                <TouchableOpacity onPress={() => router.push('/ranks')} style={{ alignItems: 'center' }}>
                  <Text style={styles.gridCardLabel}>RIVAL RANK</Text>
                  <Text
                    style={[
                      styles.seasonWrapValue,
                      { color: '#D8A81D', fontStyle: 'italic', letterSpacing: 1.5, fontSize: 26, lineHeight: 24 },
                      ...(Platform.OS === 'web' ? [{
                        backgroundImage: 'linear-gradient(180deg, #FFE48A, #D8A81D)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        color: 'transparent',
                      } as any] : []),
                    ]}
                  >
                    {rankName.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={{ alignItems: 'center' }}><Text style={styles.gridCardLabel}>WEEKLY STREAK</Text><Text style={styles.seasonWrapValue}>{weeklyStreak}</Text></View>
            </View>
          </RivalCard>

          {/* Strava connection prompt — only shown pre-connection. Once
              connected, status/sync/disconnect live on the profile page
              (Connected Apps panel) instead of taking up home real estate
              on every visit. */}
          {!stravaConnected && (
            <TouchableOpacity style={styles.stravaCard} onPress={connectStrava}>
              <View>
                <Text style={styles.stravaCardTitle}>Connect Strava</Text>
                <Text style={styles.stravaCardSub}>Link your account to earn Effort from workouts</Text>
              </View>
              <Text style={styles.stravaCardArrow}>→</Text>
            </TouchableOpacity>
          )}

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

  greetingBlock: { alignItems: 'center', gap: 6, marginTop: 28, marginBottom: 44 },
  // Tracking matches the "Your Event" hero title treatment (create-league.tsx's
  // previewName / stitch-export-22's 0.5em ratio) — same recipe applied here.
  greeting: { ...RivalType.headlineLg, fontSize: 29, lineHeight: 35, letterSpacing: 14.5, textTransform: 'uppercase', color: RivalColors.textPrimary, opacity: 0.8 },
  greetingSub: { ...RivalType.bodyMd, fontSize: 14, fontStyle: 'italic', color: RivalColors.onSurfaceVariant, textAlign: 'center', maxWidth: 420, opacity: 0.9 },

  // maxWidth pulled in from 660 — the card was a wide box with a narrow
  // centered column inside it, leaving big flanking gaps. Hugging the
  // content width instead reads as one solid hero, not a box floating in a box.
  // No fixed width — alignSelf: 'center' with no width/maxWidth means the
  // card hugs whichever line (the subtitle sentence or the number) is
  // currently widest, instead of a manually-tuned width that either leaves
  // dead space beside short numbers or clips long ones. maxWidth is only a
  // safety cap for narrow mobile viewports, not a target size.
  heroCard: { alignItems: 'center', gap: 6, alignSelf: 'center', maxWidth: '92%', paddingVertical: 28, borderRadius: 28 },
  iconDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  // Swapped from marginTop:40 — that made the button sit farther from the
  // hero card (60 total: 20 parent gap + 40) and closer to the row below
  // (20, just the parent gap). marginBottom does the same 60/20 split in
  // the opposite direction: closer to the hero card above, farther from
  // the cards below.
  addWorkoutPill: { alignSelf: 'center', paddingHorizontal: 33, borderRadius: RivalRadius.full, minWidth: 180, marginBottom: 56 },
  // Wide tracking matches the "Your Event" card's title treatment
  // (create-league.tsx's previewName) — scaled down from that 0.5em ratio
  // since this label has more characters to fit in the same card width.
  heroLabel: { ...RivalType.labelCaps, fontSize: 20, letterSpacing: 4.36, color: RivalColors.textPrimary },
  // Blown up well past displayHero's base 48px, plus the same glow recipe as
  // the race countdown number (textShadow, since it needs to hug the glyphs)
  // — this is the number of the whole page, it should hit like one.
  // Subtle top-to-bottom gradient instead of a flat fill — web-only (CSS
  // background-clip: text has no RN-native equivalent without pulling in a
  // gradient/masking library), same Platform.OS guard pattern used elsewhere
  // in this file for web-only CSS. Native falls back to the flat mid-tone.
  heroValue: {
    ...RivalType.displayHero, fontSize: 96, lineHeight: 100, color: '#D8A81D',
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'linear-gradient(180deg, #FFE48A, #D8A81D)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      color: 'transparent',
    } as any : {}),
  },
  // Same digits-vs-unit split as the streak card's "WEEKS" suffix — smaller,
  // lighter weight, muted color — so "186h 10m" reads as two number+unit
  // pairs instead of the "h"/"m" fusing into the digits around them.
  heroValueUnit: { fontWeight: '600', color: RivalColors.textPrimary },
  heroSub: { ...RivalType.bodyMd, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', color: RivalColors.textPrimary, textAlign: 'center' },

  seasonBanner: { backgroundColor: 'rgba(20,20,20,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: RivalRadius.DEFAULT, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { fontSize: 22 },
  bannerTitle: { ...RivalType.bodyMd, fontWeight: '700', color: RivalColors.textPrimary },
  bannerSub: { fontSize: 12, color: RivalColors.textSecondary, marginTop: 2 },

  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { flex: 1, minWidth: 230, minHeight: 320, gap: 8 },
  gridCardQuarter: { flexBasis: '22%', minWidth: 0 },
  // Same recipe as discover-leagues.tsx's team crest cards (gridCardHovered
  // there) — scale + lifted shadow, web-only (no hover concept natively).
  gridCardHovered: { transform: [{ scale: 1.03 }], ...(Platform.OS === 'web' ? { boxShadow: '0 12px 28px rgba(0,0,0,0.35)' } as any : {}) },
  goalsEmptyCentered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  // The message is the hero here, not the "FOCUS" tag above it — normal
  // weight, not a heading, matching the reference's "message > title" note.
  goalsEmptyTitle: { ...RivalType.bodyMd, fontSize: 15, lineHeight: 19, color: RivalColors.textPrimary, textAlign: 'center' },
  // Weekly Leader empty state title — same weight/scale as the populated
  // card's "210 Effort" value, so the card doesn't feel lesser before you're on the board.
  leaderEmptyTitle: { fontSize: 14, fontWeight: '500', lineHeight: 17, color: RivalColors.textPrimary, textAlign: 'center', letterSpacing: 3 },
  leaderEmptySub: { fontSize: 11, fontWeight: '500', color: '#ffcabb', letterSpacing: 1, marginTop: 3, textAlign: 'center', lineHeight: 14 },
  // Shared between the empty and active Focus card states — same small
  // tracked label either way.
  focusLabel: { ...RivalType.labelCaps, fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)' },
  focusGoalTitle: { ...RivalType.bodyMd, fontSize: 13, color: RivalColors.onSurfaceVariant, marginTop: 2 },
  // Minimal text link, not a filled pill — the whole card is already the tap
  // target (with its own hover pop), so a heavy CTA button here would be
  // redundant with that.
  focusEmptyLink: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  focusEmptyLinkBottom: { alignSelf: 'center', marginTop: 0, marginBottom: 10 },
  focusEmptyLinkRow: { flexDirection: 'row' },
  gridCardLabel: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.textSecondary },
  gridCardValue: { fontSize: 38, fontWeight: '300', color: RivalColors.accentText },
  gridCardValueSub: { fontSize: 14, color: RivalColors.textSecondary },
  focusProgressBarWrap: { width: '100%', justifyContent: 'center' },
  // Thinner (10 vs 16) and the % muted further — was fighting the fill for
  // attention; this labels the bar instead of competing with the progress
  // number above it.
  focusProgressPctOnBar: {
    position: 'absolute', alignSelf: 'center', fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  // Active-goal card: left-aligned instead of centered (goalsEmptyCentered's
  // default), since a full-width progress bar can only share a left edge
  // with the number above it under left alignment, not centered text of a
  // different width. gap:0 because spacing between these is hand-tuned per
  // element below (3 clusters — what/how/next — not one even rhythm).
  focusActiveTopGroup: { alignItems: 'center', paddingTop: 4 },
  focusActiveMidGroup: { alignItems: 'center' },
  focusActiveTitleGap: { marginTop: 2 },
  focusActiveBarGap: { marginTop: 4 },
  focusActiveMetaGap: { marginTop: 4 },
  gridCardMeta: { fontSize: 11, color: RivalColors.textSecondary },

  pulseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseValueShrink: { fontSize: 28, lineHeight: 32 },
  // transform is visual-only in RN — moves just this number closer to the
  // medal above without shifting the message/team-name/podium/link below it.
  pulseValueNudgeUp: { transform: [{ translateY: -8 }] },
  // transform-only (visual, doesn't affect layout flow) — nudges just the
  // medal down, closer to evenly splitting the gap between the title above
  // and "210 Effort" below, without shifting the title, Effort, podium, or
  // link, all of which stay anchored to their existing flex positions.
  pulseMedalNudgeDown: { transform: [{ translateY: 1 }] },
  pulseStoryMessage: { fontSize: 15, fontWeight: '600', color: RivalColors.accentText, letterSpacing: 1.5, marginTop: 8, textAlign: 'center' },
  pulseStoryNumber: { fontSize: 16 },
  podiumWrap: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', gap: 6 },
  podiumRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  podiumRank: { fontSize: 10, fontWeight: '700', color: RivalColors.textSecondary, width: 22 },
  podiumName: { flex: 1, fontSize: 14, color: RivalColors.textPrimary },
  podiumGap: { fontSize: 14, fontWeight: '600', color: RivalColors.textSecondary },
  podiumNameFirst: { fontSize: 16 },
  podiumGapFirst: { fontSize: 16, color: '#ECC654' },
  podiumNameSelf: { fontWeight: '700' },
  podiumGapSelf: { color: RivalColors.accentText },
  podiumFooterMeta: { fontSize: 11, color: RivalColors.textSecondary, marginTop: 0 },

  // Hero crest for the single highlighted team — ~15% larger than the old
  // list-row logo (30px) per the "make the crests shine" note.
  momentumHeroLogo: { width: 56, height: 56, borderRadius: 28 },
  momentumHeroAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: RivalColors.tertiaryContainer, alignItems: 'center', justifyContent: 'center' },
  medalRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(236,198,84,0.5)', alignItems: 'center', justifyContent: 'center' },
  momentumAvatarText: { fontSize: 14, color: RivalColors.textPrimary, fontWeight: '700' },

  snapshotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  snapshotHeroValue: { fontSize: 17, fontWeight: '700', color: RivalColors.textPrimary },
  snapshotDivider: { height: 1, width: '70%', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: -3 },
  snapshotHoverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  snapshotHeroValueLead: { fontSize: 25, color: RivalColors.accentText },

  seasonWrap: { gap: 14, width: '50%', alignSelf: 'center' },
  seasonWrapRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  seasonWrapValue: { fontSize: 20, fontWeight: '600', color: RivalColors.textPrimary, marginTop: 4 },
  addRaceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: RivalRadius.full, backgroundColor: 'rgba(255,181,158,0.12)', borderWidth: 1, borderColor: 'rgba(255,181,158,0.3)' },
  addRaceBtnText: { fontSize: 13, fontWeight: '700', color: RivalColors.accentText },

  stravaCard: { backgroundColor: 'rgba(20,20,20,0.55)', borderRadius: RivalRadius.DEFAULT, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: RivalColors.outlineVariant },
  stravaCardTitle: { fontSize: 15, fontWeight: '700', color: RivalColors.textPrimary },
  stravaCardSub: { fontSize: 12, color: RivalColors.textSecondary, marginTop: 2 },
  stravaCardArrow: { fontSize: 20, color: RivalColors.accentText },

});
