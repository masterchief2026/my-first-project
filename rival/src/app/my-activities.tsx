import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, ScrollView, Image, Platform, ImageBackground, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { formatDuration, formatDurationClock } from '../lib/format';
import { calculateStreak } from '../lib/streak';
import { computeActivityInsight, InsightTone } from '../lib/activityInsights';
import { RivalTopNav, RivalIcon, activityIconName, RivalFixedBackground } from '../components/rival';
import { RivalColors, RivalRadius, RivalType } from '../constants/rivalTheme';

type ExerciseEntry = {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  distanceMeters?: number;
  prLift?: string;
};

type Activity = {
  id: string;
  name: string | null;
  activity_type: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number;
  elevation_meters: number | null;
  effort_score: number;
  photo_url: string | null;
  exercises: ExerciseEntry[] | null;
};

type MediaRow = { id: string; activity_id: string; media_url: string; media_type: 'photo' | 'video' };

type WeekGroup = {
  label: string;
  weekStart: number;
  activities: Activity[];
  total: number;
};

const DISTANCE_SPORTS = new Set([
  'Run', 'Ride', 'Swim', 'Walk', 'Hike', 'Rowing',
  'VirtualRun', 'VirtualRide', 'NordicSki', 'AlpineSki',
  'Kayaking', 'StandUpPaddling', 'Surfing',
]);

// Sports where distances rarely clear 1km — showing metres reads better than
// a stunted "0.4 km".
const METERS_SPORTS = new Set(['Swim', 'Rowing']);

// Water sports — any recorded "elevation" is GPS noise, never a real climb,
// so the elevation tile is suppressed for these.
const WATER_SPORTS = new Set(['Swim', 'Rowing', 'Kayaking', 'StandUpPaddling', 'Surfing']);

// PB badge (~21px: 3+3 padding + 15px text) + the card's 14px stack gap —
// how far the inline photo rides up to sit level with the badge.
const PB_BADGE_OFFSET = 35;
// Icon-button row (30px) + the card's 14px stack gap — how far the inline
// photo extends DOWN past the stats row so its bottom lines up with the
// insight/actions row's bottom. Negative marginBottom keeps the overhang out
// of layout so the insight row doesn't get pushed down and chase it.
const INSIGHT_ROW_OVERHANG = 44;

const EFFORT_MULTIPLIERS: Record<string, number> = {
  Run: 1.2, Ride: 1.0, Swim: 1.5, WeightTraining: 0.8, Workout: 0.8,
  Hike: 0.7, Walk: 0.5, Yoga: 0.5, CrossFit: 1.3, AlpineSki: 0.9,
  NordicSki: 1.2, Kayaking: 0.8, Rowing: 1.1, StandUpPaddling: 0.7,
  Surfing: 0.7, VirtualRide: 0.9, VirtualRun: 1.1, Hyrox: 1.4, HIIT: 1.1,
};

const INSIGHT_ICON: Record<InsightTone, 'trophy' | 'fire' | 'trendUp'> = {
  record: 'trophy',
  streak: 'fire',
  comeback: 'trendUp',
};
const INSIGHT_COLOR: Record<InsightTone, string> = {
  record: RivalColors.rankAnchors.unrivaled,
  streak: RivalColors.accentText,
  comeback: RivalColors.tertiary,
};

function getMondayStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function MyActivitiesScreen() {
  const { width: windowWidth } = useWindowDimensions();
  // Two-up card grid only kicks in with room for it; below this everything stacks.
  const wide = windowWidth >= 760;
  // Inline gallery placement needs real room beside the stat column, which
  // only the widest cards have. In the 2-up grid (48% flexBasis + flexGrow),
  // the only card that renders full-row is the LAST card of a week with an
  // odd activity count — that's decidable at render time, no measuring needed.
  const spaciousWindow = windowWidth >= 900;
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [thisWeekTotal, setThisWeekTotal] = useState(0);
  const [pbs, setPbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrorActivityId, setUploadErrorActivityId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [mediaMap, setMediaMap] = useState<Record<string, MediaRow[]>>({});
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  // Effort badge height should track the stat column's height (not the photo's,
  // which can stand taller) — measured directly since flex stretch can't single
  // out two of three row siblings.
  const [statColHeights, setStatColHeights] = useState<Record<string, number>>({});
  // Web-only hover tooltip for the ×N multiplier badge — `title` isn't reliably
  // forwarded to the DOM by react-native-web, so we render our own popup.
  const [hoveredMultiplierId, setHoveredMultiplierId] = useState<string | null>(null);
  const [hoveredToolbarBtn, setHoveredToolbarBtn] = useState<string | null>(null);

  const [filterType, setFilterType] = useState('All');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [prOnly, setPrOnly] = useState(false);
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  useFocusEffect(useCallback(() => {
    loadActivities();
  }, []));

  async function loadActivities() {
    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      user = refreshed.user;
    }
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from('activities')
      .select('id, name, activity_type, started_at, duration_seconds, distance_meters, elevation_meters, effort_score, photo_url, exercises')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(100);

    if (data) {
      setAllActivities(data);

      const currentWeekStart = getMondayStart(new Date());

      const byType = new Map<string, Activity[]>();
      for (const activity of data) {
        if (!byType.has(activity.activity_type)) byType.set(activity.activity_type, []);
        byType.get(activity.activity_type)!.push(activity);
      }

      const pbMap: Record<string, string> = {};
      for (const [type, acts] of byType) {
        if (acts.length < 2) continue;
        const useDistance = DISTANCE_SPORTS.has(type);
        let record = acts[0];
        for (const a of acts) {
          const metric = useDistance ? (a.distance_meters || 0) : (a.duration_seconds || 0);
          const recMetric = useDistance ? (record.distance_meters || 0) : (record.duration_seconds || 0);
          if (metric > recMetric) record = a;
        }
        const metricVal = useDistance ? (record.distance_meters || 0) : (record.duration_seconds || 0);
        if (metricVal > 0) pbMap[record.id] = useDistance ? `Furthest ${type}` : `Longest ${type}`;
      }
      setPbs(pbMap);

      const thisWeek = data.filter(a => getMondayStart(new Date(a.started_at)) === currentWeekStart);
      setThisWeekTotal(Math.round(thisWeek.reduce((s, a) => s + (a.effort_score || 0), 0) * 10) / 10);

      const activityIds = data.map(a => a.id);
      if (activityIds.length > 0) {
        const { data: mediaData } = await supabase
          .from('activity_media')
          .select('id, activity_id, media_url, media_type')
          .in('activity_id', activityIds)
          .order('created_at', { ascending: true });

        const newMediaMap: Record<string, MediaRow[]> = {};
        (mediaData || []).forEach((m: MediaRow) => {
          if (!newMediaMap[m.activity_id]) newMediaMap[m.activity_id] = [];
          newMediaMap[m.activity_id].push(m);
        });
        setMediaMap(newMediaMap);
      }
    }
    setLoading(false);
  }

  const MAX_PHOTOS = 2;
  const MAX_VIDEOS = 1;
  const MAX_PHOTO_MB = 15;
  const MAX_VIDEO_MB = 50;

  function reportUploadError(activityId: string, msg: string) {
    setUploadErrorActivityId(activityId);
    setUploadError(msg);
  }

  async function uploadPhoto(activityId: string) {
    if (Platform.OS !== 'web') return;
    setUploadError(null);
    setUploadErrorActivityId(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;
      setUploading(activityId);
      try {
        const existing = mediaMap[activityId] || [];
        const existingCount = existing.length;
        let photoCount = existing.filter(m => m.media_type === 'photo').length;
        let videoCount = existing.filter(m => m.media_type === 'video').length;
        let firstNewPhotoUrl: string | null = null;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const mediaType: 'photo' | 'video' = file.type.startsWith('video') ? 'video' : 'photo';
          const sizeMb = file.size / (1024 * 1024);

          if (mediaType === 'video' && sizeMb > MAX_VIDEO_MB) {
            reportUploadError(activityId, `Video too large (max ${MAX_VIDEO_MB}MB)`);
            continue;
          }
          if (mediaType === 'photo' && sizeMb > MAX_PHOTO_MB) {
            reportUploadError(activityId, `Photo too large (max ${MAX_PHOTO_MB}MB)`);
            continue;
          }
          if (mediaType === 'photo' && photoCount >= MAX_PHOTOS) {
            reportUploadError(activityId, `Max ${MAX_PHOTOS} photos per workout`);
            continue;
          }
          if (mediaType === 'video' && videoCount >= MAX_VIDEOS) {
            reportUploadError(activityId, `Max ${MAX_VIDEOS} video per workout`);
            continue;
          }

          const ext = file.name.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
          const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const path = `${userId}/${activityId}-${uniqueId}.${ext}`;

          const { error: storageErr } = await supabase.storage
            .from('activity-photos')
            .upload(path, file, { contentType: file.type, upsert: true });

          if (storageErr) {
            reportUploadError(activityId, `Storage: ${storageErr.message}`);
            continue;
          }

          const { data: urlData } = supabase.storage.from('activity-photos').getPublicUrl(path);

          const { data: inserted, error: dbErr } = await supabase
            .from('activity_media')
            .insert({ activity_id: activityId, media_url: urlData.publicUrl, media_type: mediaType })
            .select('id, activity_id, media_url, media_type')
            .single();

          if (dbErr) {
            reportUploadError(activityId, `DB: ${dbErr.message}`);
            continue;
          }

          setMediaMap(prev => ({
            ...prev,
            [activityId]: [...(prev[activityId] || []), inserted as MediaRow],
          }));

          if (mediaType === 'photo') {
            photoCount++;
            if (!firstNewPhotoUrl) firstNewPhotoUrl = urlData.publicUrl;
          } else {
            videoCount++;
          }
        }

        if (firstNewPhotoUrl && existingCount === 0) {
          await supabase.from('activities').update({ photo_url: firstNewPhotoUrl }).eq('id', activityId);
          setAllActivities(prev => prev.map(a =>
            a.id === activityId ? { ...a, photo_url: firstNewPhotoUrl! } : a
          ));
        }
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  function startEditing(activity: Activity) {
    setEditingId(activity.id);
    setEditingName(activity.name || activity.activity_type);
  }

  async function saveName(activityId: string) {
    const trimmed = editingName.trim();
    if (!trimmed) { setEditingId(null); return; }

    const { error } = await supabase
      .from('activities')
      .update({ name: trimmed, name_locked: true })
      .eq('id', activityId);

    if (!error) {
      setAllActivities(prev => prev.map(a =>
        a.id === activityId ? { ...a, name: trimmed } : a
      ));
    }
    setEditingId(null);
  }

  function weekLabel(weekStart: number, currentWeekStart: number) {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (weekStart === currentWeekStart) return 'This week';
    if (weekStart === currentWeekStart - oneWeek) return 'Last week';
    const start = new Date(weekStart);
    const end = new Date(weekStart + 6 * 24 * 60 * 60 * 1000);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
  }

  function computeGroups(activities: Activity[], order: 'latest' | 'oldest'): WeekGroup[] {
    const currentWeekStart = getMondayStart(new Date());
    const map = new Map<number, Activity[]>();
    for (const activity of activities) {
      const ws = getMondayStart(new Date(activity.started_at));
      if (!map.has(ws)) map.set(ws, []);
      map.get(ws)!.push(activity);
    }

    const weekGroups: WeekGroup[] = [];
    const sortedWeeks = Array.from(map.keys()).sort((a, b) => order === 'latest' ? b - a : a - b);
    for (const ws of sortedWeeks) {
      const acts = map.get(ws)!.slice().sort((x, y) => {
        const dx = new Date(x.started_at).getTime();
        const dy = new Date(y.started_at).getTime();
        return order === 'latest' ? dy - dx : dx - dy;
      });
      const total = Math.round(acts.reduce((s, a) => s + (a.effort_score || 0), 0) * 10) / 10;
      weekGroups.push({ label: weekLabel(ws, currentWeekStart), weekStart: ws, activities: acts, total });
    }
    return weekGroups;
  }

  const activityTypes = Array.from(new Set(allActivities.map(a => a.activity_type))).sort();
  const filteredActivities = allActivities.filter(a =>
    (filterType === 'All' || a.activity_type === filterType) && (!prOnly || !!pbs[a.id])
  );
  const groups = computeGroups(filteredActivities, sortOrder);

  const currentWeekStartForHero = getMondayStart(new Date());
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  // allActivities is capped at 100 most-recent rows (see loadActivities) — plenty
  // for a streak read, which only ever looks a handful of weeks back.
  const streak = calculateStreak(allActivities);

  // Weekly momentum — the hero tells a story (this week vs last), not just a number.
  function weekAgg(weekStart: number) {
    const acts = allActivities.filter(a => getMondayStart(new Date(a.started_at)) === weekStart);
    return {
      count: acts.length,
      effort: acts.reduce((s, a) => s + (a.effort_score || 0), 0),
      seconds: acts.reduce((s, a) => s + (a.duration_seconds || 0), 0),
      km: acts.reduce((s, a) => s + (a.distance_meters || 0), 0) / 1000,
      elevationM: acts.reduce((s, a) => s + (a.elevation_meters || 0), 0),
    };
  }
  const thisWk = weekAgg(currentWeekStartForHero);
  const lastWk = weekAgg(currentWeekStartForHero - oneWeekMs);
  const thisWeekCount = thisWk.count;
  const effortDelta = lastWk.effort > 0 ? Math.round((thisWk.effort - lastWk.effort) / lastWk.effort * 100) : null;

  // One real, computed line of encouragement — never generic filler, always
  // tied to this week's actual numbers.
  // Split into a highlighted lead-in (rendered in accent color) + the rest, so
  // the nudge carries the same visual weight as the delta stat above it instead
  // of reading as a muted footnote.
  // Several angles can all be true at once (behind last week, below your best
  // week, below your monthly average, mid-streak) — rotate between whichever
  // apply so the hero doesn't say the exact same thing every day. The pick is
  // seeded by the day-of-year so it's stable within a day, not random per render.
  function weekContextLine(): { highlight: string; rest: string } | null {
    if (thisWk.count === 0) return null; // heroDeltaMuted already covers the empty case
    const earned = formatDuration(thisWk.seconds);

    const candidates: Array<{ highlight: string; rest: string }> = [];

    if (lastWk.effort > 0) {
      const gap = Math.round((lastWk.effort - thisWk.effort) * 10) / 10;
      if (gap > 0) candidates.push({ highlight: `${gap} Effort`, rest: ' until you match last week.' });
      else candidates.push({ highlight: `You've already beaten last week's Effort`, rest: ' — keep it up.' });
    }

    // All-time best week (excluding this one in progress).
    const weeklyEffort = new Map<number, number>();
    allActivities.forEach((a) => {
      const ws = getMondayStart(new Date(a.started_at));
      if (ws === currentWeekStartForHero) return;
      weeklyEffort.set(ws, (weeklyEffort.get(ws) || 0) + (a.effort_score || 0));
    });
    const bestWeekEver = Math.max(0, ...weeklyEffort.values());
    if (bestWeekEver > 0 && thisWk.effort < bestWeekEver) {
      const gap = Math.round((bestWeekEver - thisWk.effort) * 10) / 10;
      candidates.push({ highlight: `${gap} Effort`, rest: ' until your strongest week.' });
    }

    // Average weekly effort so far this calendar month (excluding this week).
    const now = new Date();
    const monthWeeks = Array.from(weeklyEffort.entries()).filter(([ws]) => {
      const d = new Date(ws);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    if (monthWeeks.length > 0) {
      const monthlyAvg = monthWeeks.reduce((s, [, e]) => s + e, 0) / monthWeeks.length;
      if (monthlyAvg > 0 && thisWk.effort >= monthlyAvg) {
        const ahead = Math.round((thisWk.effort - monthlyAvg) * 10) / 10;
        candidates.push({ highlight: `${ahead} Effort`, rest: ' ahead of your monthly average.' });
      }
    }

    if (streak.current > 0) {
      candidates.push({ highlight: `Keep your ${streak.current}-week streak`, rest: ' alive.' });
    }

    if (candidates.length === 0) {
      return { highlight: `You've earned ${earned}`, rest: ' this week. Every session counts.' };
    }

    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000));
    return candidates[dayOfYear % candidates.length];
  }
  const contextLine = weekContextLine();

  // Monthly PB snapshot — a calendar-month roundup of every record set (both
  // cardio distance/duration PBs from `pbs` and lift PRs tagged on exercises),
  // not just this week's. Reuses data already loaded, no extra query.
  const now = new Date();
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  type MonthlyPb = { id: string; eyebrow: string; title: string; value: string; unit: string; progress: string | null; date: string };
  const monthlyPbs: MonthlyPb[] = [];
  allActivities.forEach((a) => {
    const d = new Date(a.started_at);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
    if (pbs[a.id]) {
      const useDistance = DISTANCE_SPORTS.has(a.activity_type);
      // Second-best of the same type gives the "how much better" delta line.
      const rivals = allActivities.filter(o => o.activity_type === a.activity_type && o.id !== a.id);
      if (useDistance) {
        const prev = Math.max(0, ...rivals.map(o => o.distance_meters || 0));
        const deltaM = (a.distance_meters || 0) - prev;
        const deltaLabel = deltaM >= 1000 ? `${(deltaM / 1000).toFixed(1)}KM` : `${Math.round(deltaM)}M`;
        const useMeters = METERS_SPORTS.has(a.activity_type);
        monthlyPbs.push({
          id: a.id, eyebrow: 'RECORD DISTANCE', title: a.activity_type,
          value: useMeters ? `${Math.round(a.distance_meters || 0)}` : ((a.distance_meters || 0) / 1000).toFixed(1),
          unit: useMeters ? 'M' : 'KM',
          progress: prev > 0 ? `+${deltaLabel} IMPROVEMENT` : null,
          date: a.started_at,
        });
      } else {
        const prev = Math.max(0, ...rivals.map(o => o.duration_seconds || 0));
        const deltaMin = Math.round(((a.duration_seconds || 0) - prev) / 60);
        monthlyPbs.push({
          id: a.id, eyebrow: 'RECORD DURATION', title: a.activity_type,
          value: formatDuration(a.duration_seconds), unit: '',
          progress: prev > 0 && deltaMin > 0 ? `+${deltaMin} MIN IMPROVEMENT` : null,
          date: a.started_at,
        });
      }
    }
    (a.exercises || []).forEach((ex) => {
      if (!ex.prLift) return;
      // Previous best for the same canonical lift, from earlier tagged PBs.
      const started = new Date(a.started_at).getTime();
      let prevBest = 0;
      allActivities.forEach((o) => {
        if (new Date(o.started_at).getTime() >= started) return;
        (o.exercises || []).forEach((oe) => {
          if (oe.prLift === ex.prLift && (oe.weight || 0) > prevBest) prevBest = oe.weight || 0;
        });
      });
      const delta = ex.weight && prevBest > 0 ? Math.round((ex.weight - prevBest) * 10) / 10 : null;
      monthlyPbs.push({
        id: `${a.id}-${ex.prLift}`, eyebrow: 'NEW PEAK REACHED', title: ex.prLift,
        value: ex.weight ? `${ex.weight}` : 'PB', unit: ex.weight ? 'KG' : '',
        progress: delta && delta > 0 ? `+${delta}KG IMPROVEMENT` : null,
        date: a.started_at,
      });
    });
  });
  monthlyPbs.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  function ordinalDay(day: number): string {
    if (day % 10 === 1 && day !== 11) return `${day}st`;
    if (day % 10 === 2 && day !== 12) return `${day}nd`;
    if (day % 10 === 3 && day !== 13) return `${day}rd`;
    return `${day}th`;
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    return `${weekday}, ${month} ${ordinalDay(d.getDate())}`;
  }

  function formatExerciseLine(ex: ExerciseEntry) {
    const parts: string[] = [];
    if (ex.sets) parts.push(`${ex.sets}x${ex.reps ?? ''}`.replace(/x$/, ''));
    else if (ex.reps) parts.push(`${ex.reps} reps`);
    if (ex.weight) parts.push(`${ex.weight}kg`);
    if (ex.distanceMeters) parts.push(`${(ex.distanceMeters / 1000).toFixed(1)}km`);
    return `${ex.name}${parts.length > 0 ? ` — ${parts.join(' · ')}` : ''}`;
  }

  // Sport-appropriate pace: cycling reads as speed (km/h), swimming as /100m,
  // everything else as min/km.
  function formatPace(meters: number, seconds: number, activityType: string): string | null {
    if (!DISTANCE_SPORTS.has(activityType) || !meters || meters < 100 || !seconds) return null;
    if (activityType === 'Ride' || activityType === 'VirtualRide') {
      return `${((meters / 1000) / (seconds / 3600)).toFixed(1)} km/h`;
    }
    const per = activityType === 'Swim' ? seconds / (meters / 100) : seconds / (meters / 1000);
    const m = Math.floor(per / 60);
    const s = Math.round(per % 60);
    return `${m}:${String(s).padStart(2, '0')} ${activityType === 'Swim' ? '/100m' : '/km'}`;
  }

  function formatDistance(meters: number, activityType?: string) {
    if (!meters || meters < 100) return null;
    if (activityType && METERS_SPORTS.has(activityType)) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return (
    <View style={styles.root}>
      <RivalFixedBackground
        source={require('../../assets/images/backgrounds/optimized/handstand-airy-warehouse-gym.jpg')}
        focalPoint="50% 38%"
      />
      <View style={styles.scrim} />
      <SafeAreaView style={styles.container}>
        <RivalTopNav active="activity" />
        <ScrollView contentContainerStyle={styles.content}>

        {/* Hero — this week's momentum, not just a number. Two columns on wide
            screens: the score/stats story on the left, Lifts link + this
            month's PB snapshot on the right (was empty space before). */}
        <View style={styles.hero}>
          <View style={[styles.heroBody, wide && styles.heroBodyWide]}>
            <View style={styles.heroMain}>
              <Text style={styles.heroEyebrow}>THIS WEEK</Text>
              <View style={styles.heroScoreRow}>
                <Text style={styles.heroScore}>{thisWeekTotal}</Text>
                <View style={styles.heroScoreSide}>
                  <Text style={styles.heroScoreUnit}>EFFORT</Text>
                  {effortDelta !== null ? (
                    <Text style={[styles.heroDelta, { color: effortDelta >= 0 ? RivalColors.success : RivalColors.textSecondary }]}>
                      {effortDelta >= 0 ? '↑' : '↓'} {Math.abs(effortDelta)}% vs last week
                    </Text>
                  ) : (
                    <Text style={styles.heroDeltaMuted}>{thisWk.count > 0 ? 'Momentum building' : 'Log your first this week'}</Text>
                  )}
                </View>
              </View>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{thisWeekCount}</Text>
                  <Text style={styles.heroStatLabel}>Activities</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{formatDuration(thisWk.seconds) || '0m'}</Text>
                  <Text style={styles.heroStatLabel}>Earned</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{thisWk.km >= 0.1 ? `${thisWk.km.toFixed(1)}` : '0'}</Text>
                  <Text style={styles.heroStatLabel}>km</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{thisWk.elevationM >= 1 ? Math.round(thisWk.elevationM) : '0'}</Text>
                  <Text style={styles.heroStatLabel}>Elevation (m)</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, streak.current > 0 && { color: RivalColors.accentText }]}>{streak.current}w</Text>
                  <Text style={styles.heroStatLabel}>Streak</Text>
                </View>
              </View>

              {contextLine && (
                <Text style={styles.contextLine}>
                  <Text style={styles.contextLineHighlight}>{contextLine.highlight}</Text>
                  {contextLine.rest}
                </Text>
              )}
            </View>

            <View style={[styles.heroSide, wide && styles.heroSideWide]}>
              <TouchableOpacity style={styles.liftsLink} onPress={() => router.push('/lifts')}>
                <RivalIcon name="target" size={16} color={RivalColors.textSecondary} />
                <Text style={styles.liftsLinkText}>View Personal Bests</Text>
                <RivalIcon name="forward" size={14} color={RivalColors.accentText} />
              </TouchableOpacity>

              <View style={styles.monthlyPbCard}>
                <View style={styles.monthlyPbHeader}>
                  <Text style={styles.monthlyPbTitle}>{monthName} PBs</Text>
                  {monthlyPbs.length > 0 && (
                    <View style={styles.monthlyPbCount}>
                      <Text style={styles.monthlyPbCountText}>{monthlyPbs.length}</Text>
                    </View>
                  )}
                </View>
                {monthlyPbs.length === 0 ? (
                  <Text style={styles.monthlyPbEmpty}>No PBs yet this month — get after it.</Text>
                ) : (
                  <ScrollView style={styles.monthlyPbScroll} contentContainerStyle={styles.monthlyPbList} showsVerticalScrollIndicator={false}>
                    {monthlyPbs.map((pb) => (
                      <View key={pb.id} style={styles.monthlyPbEntry}>
                        <Text style={styles.monthlyPbName} numberOfLines={1}>{pb.title}</Text>
                        <View style={styles.monthlyPbValueRow}>
                          <Text style={styles.monthlyPbValue}>{pb.value}</Text>
                          {!!pb.unit && <Text style={styles.monthlyPbUnit}>{pb.unit}</Text>}
                        </View>
                        {!!pb.progress && (
                          <View style={styles.monthlyPbProgressRow}>
                            <RivalIcon name="trendUp" size={14} color={RivalColors.accentText} />
                            <Text style={styles.monthlyPbProgress}>{pb.progress}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Section header — no "Back" link: the top nav already shows Activity as the active tab.
            Controls collapse into a compact icon toolbar so the cards start almost
            immediately after the hero, instead of five full-size buttons first. */}
        <View style={styles.sectionHeader}>
          <Text style={styles.title}>Activity</Text>
          <View style={styles.toolbarRow}>
            {([
              { key: 'refresh', icon: 'check' as const, label: 'Refresh', active: false, onPress: () => loadActivities() },
              { key: 'logweek', icon: 'calendar' as const, label: 'Log a week', active: false, onPress: () => router.push('/weekly-scan') },
              { key: 'filter', icon: 'search' as const, label: filterType === 'All' ? 'Filter by type' : `Filtered: ${filterType}`, active: filterType !== 'All', onPress: () => setShowTypeFilter(!showTypeFilter) },
              { key: 'sort', icon: sortOrder === 'latest' ? 'trendDown' as const : 'trendUp' as const, label: sortOrder === 'latest' ? 'Sorted: Latest first' : 'Sorted: Oldest first', active: false, onPress: () => setSortOrder(sortOrder === 'latest' ? 'oldest' : 'latest') },
              { key: 'prs', icon: 'fire' as const, label: 'PBs only', active: prOnly, onPress: () => setPrOnly(!prOnly) },
            ]).map(btn => (
              <View
                key={btn.key}
                style={styles.toolbarBtnWrap}
                {...({
                  onMouseEnter: () => setHoveredToolbarBtn(btn.key),
                  onMouseLeave: () => setHoveredToolbarBtn(id => id === btn.key ? null : id),
                } as any)}
              >
                <TouchableOpacity
                  style={[styles.toolbarBtn, btn.active && styles.toolbarBtnActive]}
                  onPress={btn.onPress}
                >
                  <RivalIcon name={btn.icon} size={16} color={btn.active ? RivalColors.accentText : RivalColors.textSecondary} />
                </TouchableOpacity>
                {hoveredToolbarBtn === btn.key && (
                  <View style={styles.toolbarTooltip} pointerEvents="none">
                    <Text style={styles.toolbarTooltipText}>{btn.label}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.filterBar}>
          {(filterType !== 'All' || prOnly) && !showTypeFilter && (
            <View style={styles.activeFiltersRow}>
              {filterType !== 'All' && (
                <TouchableOpacity style={styles.activeFilterChip} onPress={() => setFilterType('All')}>
                  <RivalIcon name={activityIconName(filterType)} size={12} color={RivalColors.accentText} />
                  <Text style={styles.activeFilterChipText}>{filterType}</Text>
                  <RivalIcon name="close" size={12} color={RivalColors.textSecondary} />
                </TouchableOpacity>
              )}
              {prOnly && (
                <TouchableOpacity style={styles.activeFilterChip} onPress={() => setPrOnly(false)}>
                  <RivalIcon name="fire" size={12} color={RivalColors.accentText} />
                  <Text style={styles.activeFilterChipText}>PBs only</Text>
                  <RivalIcon name="close" size={12} color={RivalColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {showTypeFilter && (
            <View style={styles.typeFilterRow}>
              <TouchableOpacity
                style={[styles.typeFilterChip, filterType === 'All' && styles.typeFilterChipActive]}
                onPress={() => { setFilterType('All'); setShowTypeFilter(false); }}
              >
                <Text style={[styles.typeFilterChipText, filterType === 'All' && styles.typeFilterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {activityTypes.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeFilterChip, filterType === t && styles.typeFilterChipActive]}
                  onPress={() => { setFilterType(t); setShowTypeFilter(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <RivalIcon name={activityIconName(t)} size={13} color={filterType === t ? RivalColors.accentText : RivalColors.textSecondary} />
                    <Text style={[styles.typeFilterChipText, filterType === t && styles.typeFilterChipTextActive]}>{t}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {loading && <Text style={styles.emptyText}>Loading…</Text>}

        {!loading && groups.length === 0 && (
          <Text style={styles.emptyText}>
            {allActivities.length === 0 ? 'No activities yet. Log a workout on Strava to get started.' : 'No activities match this filter.'}
          </Text>
        )}

        {groups.map((group) => (
          <View key={group.weekStart} style={styles.weekSection}>
            <View style={styles.weekHeader}>
              <View style={styles.weekLabelPill}>
                <Text style={styles.weekLabel}>{group.label}</Text>
              </View>
              <View style={styles.weekTotalPill}>
                <Text style={styles.weekTotal}>{group.total} Effort</Text>
              </View>
            </View>

            <View style={styles.list}>
              {group.activities.map((activity) => {
                const distance = formatDistance(activity.distance_meters, activity.activity_type);
                const pace = formatPace(activity.distance_meters, activity.duration_seconds, activity.activity_type);
                const multiplier = EFFORT_MULTIPLIERS[activity.activity_type] ?? 0.8;
                const pbLabel = pbs[activity.id];
                const isUploading = uploading === activity.id;
                const insight = computeActivityInsight(activity, allActivities, !!pbLabel);
                const hasMedia = (mediaMap[activity.id]?.length ?? 0) > 0;
                const hasExercises = (activity.exercises?.length ?? 0) > 0;
                const hasDuration = activity.duration_seconds > 0;
                const idx = group.activities.indexOf(activity);
                const isFullRow = wide && group.activities.length % 2 === 1 && idx === group.activities.length - 1;
                const cardIsSpacious = spaciousWindow && isFullRow;
                return (
                  <View
                    key={activity.id}
                    style={[styles.activityCard, wide && styles.cardHalf, pbLabel && styles.activityCardBest]}
                  >
                    {/* Header: icon · name/type · multiplier */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconBox, pbLabel && styles.iconBoxBest]}>
                        <RivalIcon
                          name={activityIconName(activity.activity_type)}
                          size={22}
                          color={pbLabel ? RivalColors.rankAnchors.unrivaled : RivalColors.accentText}
                        />
                      </View>
                      <View style={styles.cardHeaderInfo}>
                        {editingId === activity.id ? (
                          <TextInput
                            style={styles.nameInput}
                            value={editingName}
                            onChangeText={setEditingName}
                            autoFocus
                            onSubmitEditing={() => saveName(activity.id)}
                            onBlur={() => saveName(activity.id)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.typeRow} onPress={() => startEditing(activity)}>
                            <Text style={styles.activityType} numberOfLines={1}>{activity.name || activity.activity_type}</Text>
                            <RivalIcon name="edit" size={11} color={RivalColors.textSecondary} />
                          </TouchableOpacity>
                        )}
                        <Text style={styles.activityTypeSub}>{activity.activity_type}</Text>
                      </View>
                      <View
                        style={styles.multiplierBadgeWrap}
                        {...({
                          onMouseEnter: () => setHoveredMultiplierId(activity.id),
                          onMouseLeave: () => setHoveredMultiplierId(id => id === activity.id ? null : id),
                        } as any)}
                      >
                        <View style={styles.multiplierBadge}>
                          <Text style={styles.multiplierBadgeText}>×{multiplier}</Text>
                        </View>
                        {hoveredMultiplierId === activity.id && (
                          <View style={styles.multiplierTooltip} pointerEvents="none">
                            <Text style={styles.multiplierTooltipText}>Effort multiplier</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {pbLabel && (
                      <View style={styles.bestBadge}>
                        <RivalIcon name="fire" size={12} color={RivalColors.rankAnchors.unrivaled} />
                        <Text style={styles.bestBadgeText}>{pbLabel}</Text>
                      </View>
                    )}

                    {/* Stat mini-cards + exercises stacked on the left, Effort badge +
                        action icons on the right. The right column is measured to match
                        the LEFT column's full height (stats + exercises together, not
                        just stats) — a workout with a long exercise list previously left
                        the Effort badge sized to the stats alone, floating with a gap
                        above the exercise list beside it.
                        No labels — the values (date/duration/distance) are self-explanatory. */}
                    {/* Spacious cards: everything tops-out together (no centring gap
                        below the PB badge) and the Effort badge stretches to the full
                        photo height so the space beside the photo doesn't sit empty. */}
                    <View style={[styles.statsAndEffortRow, cardIsSpacious && hasMedia && styles.statsAndEffortRowSpacious]}>
                      <View
                        style={styles.statAndExerciseColumn}
                        onLayout={(e) => {
                          const h = e.nativeEvent.layout.height;
                          setStatColHeights(prev => prev[activity.id] === h ? prev : { ...prev, [activity.id]: h });
                        }}
                      >
                        <View style={styles.statColumn}>
                          <View style={styles.statTile}>
                            <Text style={styles.statTileValue}>{formatDate(activity.started_at)}</Text>
                          </View>
                          {hasDuration && (
                            <View style={styles.statTile}>
                              <Text style={styles.statTileValue}>{formatDurationClock(activity.duration_seconds)}</Text>
                            </View>
                          )}
                          {distance && (
                            <View style={styles.statTile}>
                              <Text style={styles.statTileValue}>{distance}</Text>
                            </View>
                          )}
                          {pace && (
                            <View style={styles.statTile}>
                              <Text style={styles.statTileValue}>{pace}</Text>
                            </View>
                          )}
                          {/* ↑ marks the value as elevation gain — tiles have no labels,
                              so a bare metres figure would read as distance. */}
                          {(activity.elevation_meters || 0) > 0 && !WATER_SPORTS.has(activity.activity_type) && (
                            <View style={styles.statTile}>
                              <Text style={styles.statTileValue}>↑ {Math.round(activity.elevation_meters!)} m</Text>
                            </View>
                          )}
                        </View>

                        {hasExercises && (
                          <View style={styles.exerciseBreakdown}>
                            {activity.exercises!.map((ex, exi) => (
                              <View key={exi} style={styles.exerciseRow}>
                                <RivalIcon name="weights" size={13} color={RivalColors.accentText} />
                                <Text style={styles.exerciseRowText}>{formatExerciseLine(ex)}</Text>
                                {ex.prLift && (
                                  <View style={styles.exercisePrTag}>
                                    <RivalIcon name="fire" size={10} color={RivalColors.rankAnchors.unrivaled} />
                                    <Text style={styles.exercisePrTagText}>PB</Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* On genuinely wide cards (measured, not assumed from window
                          width), media fills the gap between stats and Effort instead
                          of stacking below. Narrower cards keep the gallery below. */}
                      {cardIsSpacious && hasMedia && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          // The lift lives on the CONTAINER, not the image — the
                          // horizontal ScrollView clips children, so a negative margin
                          // on the image just cuts its top off instead of raising it.
                          // Photo spans from the PB-badge line down to the stat column's
                          // bottom: statColHeight + offset tall, shifted up by offset.
                          style={[styles.galleryInline, pbLabel && { marginTop: -PB_BADGE_OFFSET }, { marginBottom: -INSIGHT_ROW_OVERHANG }]}
                          contentContainerStyle={styles.galleryRow}
                        >
                          {mediaMap[activity.id].map((m) => (
                            m.media_type === 'video' ? (
                              <video
                                key={m.id}
                                src={m.media_url}
                                controls
                                style={{ width: 200, height: '100%', borderRadius: 10, backgroundColor: '#2A2A2A' } as any}
                              />
                            ) : (
                              <TouchableOpacity key={m.id} onPress={() => setEnlargedPhoto(m.media_url)}>
                                <Image
                                  source={{ uri: m.media_url }}
                                  style={[
                                    styles.galleryPhotoInline,
                                    statColHeights[activity.id]
                                      ? { height: statColHeights[activity.id] + (pbLabel ? PB_BADGE_OFFSET : 0) + INSIGHT_ROW_OVERHANG }
                                      : null,
                                  ]}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            )
                          ))}
                        </ScrollView>
                      )}

                      {/* Same height as the stat column always; on spacious cards it
                          also grows WIDE to absorb the leftover space beside the photo,
                          with the number scaled up to suit the larger canvas. */}
                      <View
                        style={[
                          styles.effortBadge,
                          pbLabel && styles.effortBadgeBest,
                          statColHeights[activity.id] ? { height: statColHeights[activity.id] } : null,
                          // Grows to use the free width but capped near-square
                          // (slightly wider than tall) so it reads as a tile, not a bar.
                          cardIsSpacious && hasMedia && { flexGrow: 1, maxWidth: Math.max(200, (statColHeights[activity.id] || 0) * 1.15) },
                        ]}
                      >
                        <Text style={[styles.points, cardIsSpacious && hasMedia && styles.pointsLarge, pbLabel && { color: RivalColors.rankAnchors.unrivaled }]}>
                          {activity.effort_score}
                        </Text>
                        <Text style={[styles.pointsUnit, cardIsSpacious && hasMedia && styles.pointsUnitLarge, pbLabel && { color: RivalColors.rankAnchors.unrivaled }]}>EFFORT</Text>
                      </View>
                    </View>

                    {/* Insight (if any) always shares this row with the action icons,
                        so the icons land in the same place whether or not an insight
                        line is present — never stacked under Effort inside the taller
                        stats row above. */}
                    <View style={styles.insightFooterRow}>
                      {insight ? (
                        <View style={styles.insightRow}>
                          <RivalIcon name={INSIGHT_ICON[insight.tone]} size={12} color={INSIGHT_COLOR[insight.tone]} />
                          <Text style={[styles.insightText, { color: INSIGHT_COLOR[insight.tone] }]}>{insight.text}</Text>
                        </View>
                      ) : <View />}
                      <View style={styles.rightColBtnRow}>
                        <TouchableOpacity style={styles.cameraBtn} onPress={() => uploadPhoto(activity.id)} disabled={isUploading}>
                          <RivalIcon name={isUploading ? 'timer' : 'camera'} size={18} color={RivalColors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cameraBtn} onPress={() => router.push(`/scan-workout?activityId=${activity.id}`)}>
                          <RivalIcon name="settings" size={18} color={RivalColors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cameraBtn} onPress={() => router.push(`/ai-share?activityId=${activity.id}`)}>
                          <RivalIcon name="ai" size={18} color={RivalColors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {uploadErrorActivityId === activity.id && uploadError && (
                      <Text style={styles.inlineUploadError}>⚠️ {uploadError}</Text>
                    )}

                    {/* Media gallery — only stacked here on narrow cards; wide cards
                        show it inline in the stats row above instead. */}
                    {hasMedia && !cardIsSpacious && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                        {mediaMap[activity.id].map((m) => (
                          m.media_type === 'video' ? (
                            <video
                              key={m.id}
                              src={m.media_url}
                              controls
                              style={{ width: 220, height: 220, borderRadius: 10, backgroundColor: '#2A2A2A' } as any}
                            />
                          ) : (
                            <TouchableOpacity key={m.id} onPress={() => setEnlargedPhoto(m.media_url)}>
                              <Image
                                source={{ uri: m.media_url }}
                                style={styles.galleryPhoto}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          )
                        ))}
                      </ScrollView>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

      </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-workout')}>
          <RivalIcon name="add" size={18} color={RivalColors.onAccentFill} />
          <Text style={styles.fabText}>Add Activity</Text>
        </TouchableOpacity>

        {/* Photo lightbox — click any card photo to view it full size; click
            anywhere (or ✕) to dismiss. */}
        {enlargedPhoto && (
          <TouchableOpacity style={styles.lightbox} activeOpacity={1} onPress={() => setEnlargedPhoto(null)}>
            <Image source={{ uri: enlargedPhoto }} style={styles.lightboxImage} resizeMode="contain" />
            <TouchableOpacity style={styles.lightboxClose} onPress={() => setEnlargedPhoto(null)}>
              <RivalIcon name="close" size={22} color={RivalColors.textPrimary} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RivalColors.surfaceLow },
  scrim: { position: 'fixed' as any, top: 0, left: 0, right: 0, height: '100vh' as any, backgroundColor: 'rgba(14,14,14,0.55)' },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100, maxWidth: 900, width: '100%', alignSelf: 'center' },

  // Hero
  hero: { backgroundColor: 'rgba(24,24,24,0.6)', borderWidth: 1, borderColor: 'rgba(163,140,133,0.15)', borderLeftWidth: 4, borderLeftColor: RivalColors.accentFill, borderRadius: RivalRadius.xl, padding: 28, marginBottom: 20 },
  heroBody: { flexDirection: 'column', gap: 20 },
  heroBodyWide: { flexDirection: 'row', alignItems: 'stretch' },
  heroMain: { flex: 1, justifyContent: 'space-between' },
  heroSide: { gap: 12, width: '100%' },
  heroSideWide: { width: 260, flexGrow: 0, flexShrink: 0 },
  heroEyebrow: { ...RivalType.labelCaps, fontSize: 11, letterSpacing: 3, color: RivalColors.accentText, marginBottom: 6 },
  heroScoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 22 },
  heroScore: { ...RivalType.displayHero, fontSize: 100, lineHeight: 96, color: RivalColors.textPrimary },
  heroScoreSide: { paddingBottom: 12, gap: 4 },
  heroScoreUnit: { ...RivalType.labelCaps, fontSize: 12, letterSpacing: 2, color: RivalColors.textSecondary },
  heroDelta: { fontSize: 13, fontWeight: '700' },
  heroDeltaMuted: { fontSize: 13, fontWeight: '600', color: RivalColors.textSecondary },
  heroStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 20 },
  heroStat: { gap: 3 },
  heroStatValue: { fontSize: 24, fontWeight: '700', color: RivalColors.textPrimary },
  heroStatLabel: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.textSecondary },

  // Section header
  contextLine: { fontSize: 16, color: RivalColors.textSecondary, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  contextLineHighlight: { fontWeight: '800', color: RivalColors.accentText },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 12 },
  title: { ...RivalType.headlineLg, fontSize: 22, color: RivalColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1 },
  liftsLink: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${RivalColors.rankAnchors.unrivaled}14`, borderWidth: 1, borderColor: `${RivalColors.rankAnchors.unrivaled}55`, borderRadius: RivalRadius.DEFAULT, paddingVertical: 10, paddingHorizontal: 16 },
  liftsLinkText: { color: RivalColors.rankAnchors.unrivaled, fontSize: 13, fontWeight: '600' },

  // Monthly PB snapshot — fills what used to be empty space beside the hero stats.
  monthlyPbCard: { backgroundColor: `${RivalColors.rankAnchors.unrivaled}0D`, borderWidth: 1, borderColor: `${RivalColors.rankAnchors.unrivaled}40`, borderRadius: RivalRadius.DEFAULT, padding: 14, gap: 10 },
  monthlyPbHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  monthlyPbTitle: { ...RivalType.labelCaps, fontSize: 14, letterSpacing: 1, color: RivalColors.textPrimary, textAlign: 'center' },
  monthlyPbCount: { backgroundColor: `${RivalColors.rankAnchors.unrivaled}22`, borderRadius: RivalRadius.full, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  monthlyPbCountText: { fontSize: 13, fontWeight: '800', color: RivalColors.rankAnchors.unrivaled },
  monthlyPbEmpty: { fontSize: 12, color: RivalColors.textSecondary, lineHeight: 17 },
  monthlyPbScroll: { maxHeight: 168 },
  monthlyPbList: { gap: 12 },
  monthlyPbEntry: { borderLeftWidth: 2, borderLeftColor: `${RivalColors.rankAnchors.unrivaled}55`, paddingLeft: 10, gap: 1 },
  monthlyPbName: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: RivalColors.textSecondary, textTransform: 'uppercase' },
  monthlyPbValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  monthlyPbValue: { fontSize: 28, fontWeight: '800', color: RivalColors.textPrimary, lineHeight: 32 },
  monthlyPbUnit: { fontSize: 12, fontWeight: '700', fontStyle: 'italic', color: RivalColors.textSecondary },
  monthlyPbProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  monthlyPbProgress: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: RivalColors.rankAnchors.unrivaled },
  // Compact icon toolbar — replaces the old row of 5 full-size buttons so the
  // cards start right after the hero instead of behind a wall of controls.
  toolbarRow: { flexDirection: 'row', gap: 6 },
  toolbarBtnWrap: { position: 'relative' },
  toolbarBtn: { width: 34, height: 34, borderRadius: RivalRadius.DEFAULT, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: RivalColors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  toolbarBtnActive: { backgroundColor: `${RivalColors.accentFill}1a`, borderColor: RivalColors.accentFill },
  toolbarTooltip: { position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, backgroundColor: RivalColors.surfaceContainerHighest, borderRadius: RivalRadius.sm, paddingHorizontal: 8, paddingVertical: 5, zIndex: 10 },
  toolbarTooltipText: { fontSize: 11, fontWeight: '600', color: RivalColors.textPrimary },

  filterBar: { marginBottom: 8 },
  activeFiltersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  activeFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${RivalColors.accentFill}1a`, borderWidth: 1, borderColor: RivalColors.accentFill, borderRadius: RivalRadius.full, paddingVertical: 6, paddingHorizontal: 10 },
  activeFilterChipText: { fontSize: 12, fontWeight: '700', color: RivalColors.accentText },
  typeFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  typeFilterChip: { backgroundColor: RivalColors.surfaceLowest, borderRadius: RivalRadius.sm, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: RivalColors.surfaceContainerHigh },
  typeFilterChipActive: { backgroundColor: `${RivalColors.accentFill}1a`, borderColor: RivalColors.accentFill },
  typeFilterChipText: { fontSize: 11, fontWeight: '600', color: RivalColors.textSecondary },
  typeFilterChipTextActive: { color: RivalColors.accentText },

  emptyText: { color: RivalColors.textSecondary, fontSize: 15, textAlign: 'center', paddingVertical: 24 },

  weekSection: { marginBottom: 28 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 },
  weekLabelPill: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(20,20,20,0.35)', borderRadius: RivalRadius.DEFAULT,
    borderLeftWidth: 3, borderLeftColor: RivalColors.accentFill,
  },
  weekTotalPill: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(20,20,20,0.35)', borderRadius: RivalRadius.DEFAULT },
  weekLabel: { fontSize: 16, fontWeight: '700', color: RivalColors.textPrimary },
  weekTotal: { fontSize: 16, fontWeight: '800', color: RivalColors.accentText },

  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },

  activityCard: { flexBasis: '100%', backgroundColor: 'rgba(20,20,20,0.35)', borderRadius: RivalRadius.lg, padding: 18, borderWidth: 1, borderColor: 'rgba(163,140,133,0.15)', gap: 14 },
  // Simple activities tile 2-up on wide screens; minWidth keeps them from getting cramped.
  cardHalf: { flexBasis: '48%', flexGrow: 1, minWidth: 300 },
  activityCardBest: { borderColor: `${RivalColors.rankAnchors.unrivaled}66`, borderWidth: 1.5 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderInfo: { flex: 1, gap: 2 },
  iconBox: { width: 46, height: 46, borderRadius: RivalRadius.DEFAULT, backgroundColor: `${RivalColors.accentFill}1a`, borderWidth: 1, borderColor: `${RivalColors.accentFill}33`, alignItems: 'center', justifyContent: 'center' },
  iconBoxBest: { backgroundColor: `${RivalColors.rankAnchors.unrivaled}1a`, borderColor: `${RivalColors.rankAnchors.unrivaled}4d` },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityType: { fontSize: 18, fontWeight: '700', color: RivalColors.textPrimary, flexShrink: 1 },
  activityTypeSub: { fontSize: 12, color: RivalColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  nameInput: { backgroundColor: RivalColors.surfaceContainer, borderRadius: RivalRadius.DEFAULT, paddingHorizontal: 10, paddingVertical: 6, color: RivalColors.textPrimary, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: RivalColors.accentFill },
  multiplierBadgeWrap: { position: 'relative' },
  multiplierBadge: { backgroundColor: `${RivalColors.accentFill}1a`, borderRadius: RivalRadius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  multiplierTooltip: { position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, backgroundColor: RivalColors.surfaceContainerHighest, borderRadius: RivalRadius.sm, paddingHorizontal: 8, paddingVertical: 5, zIndex: 10 },
  multiplierTooltipText: { fontSize: 11, fontWeight: '600', color: RivalColors.textPrimary },
  multiplierBadgeText: { fontSize: 13, fontWeight: '800', color: RivalColors.accentText },

  bestBadge: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, backgroundColor: `${RivalColors.rankAnchors.unrivaled}22`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RivalRadius.sm },
  bestBadgeText: { fontSize: 11, fontWeight: '700', color: RivalColors.rankAnchors.unrivaled },

  // Compact pills that hug their content — no more stretched tiles with dead space.
  // Stat mini-cards stacked on the left, Effort badge prominent on the right.
  // Centered, not stretched: the photo is its own element and may stand taller
  // than the stat column and Effort badge — they keep their natural size and
  // sit vertically centred beside it instead of inflating to match.
  statsAndEffortRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsAndEffortRowSpacious: { alignItems: 'flex-start' },
  statAndExerciseColumn: { flex: 1, gap: 10 },
  statColumn: { gap: 8 },
  statTile: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RivalRadius.DEFAULT, paddingHorizontal: 14, paddingVertical: 10 },
  statTileValue: { fontSize: 15, fontWeight: '700', color: RivalColors.textPrimary },

  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  insightFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lightbox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  lightboxImage: { width: '92%', height: '92%' },
  lightboxClose: { position: 'absolute', top: 24, right: 24, width: 44, height: 44, borderRadius: RivalRadius.full, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  insightText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  // Exercises as standout rows (icon + name/weight + PR tag) instead of plain bullet text.
  exerciseBreakdown: { gap: 6 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RivalRadius.DEFAULT, paddingHorizontal: 10, paddingVertical: 8 },
  exerciseRowText: { flex: 1, fontSize: 13, fontWeight: '600', color: RivalColors.textPrimary },
  exercisePrTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${RivalColors.rankAnchors.unrivaled}22`, borderRadius: RivalRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  exercisePrTagText: { fontSize: 10, fontWeight: '800', color: RivalColors.rankAnchors.unrivaled },

  rightColBtnRow: { flexDirection: 'row', gap: 6 },
  effortBadge: { backgroundColor: `${RivalColors.accentFill}22`, borderWidth: 1, borderColor: `${RivalColors.accentFill}55`, borderRadius: RivalRadius.md, paddingHorizontal: 20, paddingVertical: 26, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
  effortBadgeBest: { backgroundColor: `${RivalColors.rankAnchors.unrivaled}22`, borderColor: `${RivalColors.rankAnchors.unrivaled}66` },
  points: { fontSize: 28, fontWeight: '800', color: RivalColors.accentText, lineHeight: 30 },
  pointsUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: RivalColors.accentText, opacity: 0.85, marginTop: 2 },
  pointsLarge: { fontSize: 44, lineHeight: 48 },
  pointsUnitLarge: { fontSize: 13, letterSpacing: 2, marginTop: 4 },
  cameraBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RivalRadius.DEFAULT },

  galleryRow: { gap: 8 },
  galleryPhoto: { width: 220, height: 220, borderRadius: 10, backgroundColor: RivalColors.surfaceContainerHigh },
  // Hugs the photo width (no flex-grow) so the Effort badge can claim the
  // remaining row width instead.
  galleryInline: { flexGrow: 0, flexShrink: 0 },
  // Fixed height sized to dominate the card body (the Effort badge and stat
  // column stretch to match); width follows from the aspect ratio so the
  // photo keeps its proportions (cover-crops inside the frame, never stretches).
  galleryPhotoInline: { height: 320, aspectRatio: 0.8, borderRadius: 10, backgroundColor: RivalColors.surfaceContainerHigh },

  inlineUploadError: { color: RivalColors.error, fontSize: 12, fontWeight: '600' },

  fab: { position: 'absolute', bottom: 28, right: 24, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20, borderRadius: RivalRadius.full, backgroundColor: RivalColors.accentFill, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabText: { fontSize: 15, fontWeight: '700', color: RivalColors.onAccentFill },
});

