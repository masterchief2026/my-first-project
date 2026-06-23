import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

type Activity = {
  id: string;
  name: string | null;
  activity_type: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number;
  effort_score: number;
  photo_url: string | null;
};

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

const ACTIVITY_ICONS: Record<string, string> = {
  Run: '🏃', Ride: '🚴', Swim: '🏊', WeightTraining: '🏋️', Workout: '💪',
  Hike: '🥾', Walk: '🚶', Yoga: '🧘', CrossFit: '🤸', Rowing: '🚣',
  Hyrox: '🔥', HIIT: '⚡',
};

const EFFORT_MULTIPLIERS: Record<string, number> = {
  Run: 1.2, Ride: 1.0, Swim: 1.5, WeightTraining: 0.8, Workout: 0.8,
  Hike: 0.7, Walk: 0.5, Yoga: 0.5, CrossFit: 1.3, AlpineSki: 0.9,
  NordicSki: 1.2, Kayaking: 0.8, Rowing: 1.1, StandUpPaddling: 0.7,
  Surfing: 0.7, VirtualRide: 0.9, VirtualRun: 1.1, Hyrox: 1.4, HIIT: 1.1,
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
  const [groups, setGroups] = useState<WeekGroup[]>([]);
  const [thisWeekTotal, setThisWeekTotal] = useState(0);
  const [pbs, setPbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useFocusEffect(useCallback(() => {
    loadActivities();
  }, []));

  async function loadActivities() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from('activities')
      .select('id, name, activity_type, started_at, duration_seconds, distance_meters, effort_score, photo_url')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(100);

    if (data) {
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

      const map = new Map<number, Activity[]>();
      for (const activity of data) {
        const ws = getMondayStart(new Date(activity.started_at));
        if (!map.has(ws)) map.set(ws, []);
        map.get(ws)!.push(activity);
      }

      const weekGroups: WeekGroup[] = [];
      const sortedWeeks = Array.from(map.keys()).sort((a, b) => b - a);
      for (const ws of sortedWeeks) {
        const acts = map.get(ws)!;
        const total = Math.round(acts.reduce((s, a) => s + (a.effort_score || 0), 0) * 10) / 10;
        weekGroups.push({ label: weekLabel(ws, currentWeekStart), weekStart: ws, activities: acts, total });
      }

      setGroups(weekGroups);
      const thisWeek = map.get(currentWeekStart) || [];
      setThisWeekTotal(Math.round(thisWeek.reduce((s, a) => s + (a.effort_score || 0), 0) * 10) / 10);
    }
    setLoading(false);
  }

  async function uploadPhoto(activityId: string) {
    if (Platform.OS !== 'web') return;
    setUploadError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(activityId);
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${userId}/${activityId}.${ext}`;

        const { error: storageErr } = await supabase.storage
          .from('activity-photos')
          .upload(path, file, { contentType: file.type, upsert: true });

        if (storageErr) {
          setUploadError(`Storage: ${storageErr.message}`);
          return;
        }

        const { data: urlData } = supabase.storage.from('activity-photos').getPublicUrl(path);

        const { error: dbErr } = await supabase
          .from('activities')
          .update({ photo_url: urlData.publicUrl })
          .eq('id', activityId);

        if (dbErr) {
          setUploadError(`DB: ${dbErr.message}`);
          return;
        }

        setGroups(prev => prev.map(g => ({
          ...g,
          activities: g.activities.map(a =>
            a.id === activityId ? { ...a, photo_url: urlData.publicUrl } : a
          ),
        })));
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
      setGroups(prev => prev.map(g => ({
        ...g,
        activities: g.activities.map(a =>
          a.id === activityId ? { ...a, name: trimmed } : a
        ),
      })));
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

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatDuration(seconds: number) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m`;
  }

  function formatDistance(meters: number) {
    if (!meters || meters < 100) return null;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Your Activities</Text>

        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>This week</Text>
          <Text style={styles.totalValue}>{thisWeekTotal} pts</Text>
        </View>

        {uploadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {uploadError}</Text>
          </View>
        )}

        {loading && <Text style={styles.emptyText}>Loading…</Text>}

        {!loading && groups.length === 0 && (
          <Text style={styles.emptyText}>No activities yet. Log a workout on Strava to get started.</Text>
        )}

        {groups.map((group) => (
          <View key={group.weekStart} style={styles.weekSection}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{group.label}</Text>
              <Text style={styles.weekTotal}>{group.total} pts</Text>
            </View>

            <View style={styles.list}>
              {group.activities.map((activity) => {
                const distance = formatDistance(activity.distance_meters);
                const multiplier = EFFORT_MULTIPLIERS[activity.activity_type] ?? 0.8;
                const pbLabel = pbs[activity.id];
                const isUploading = uploading === activity.id;
                return (
                  <View
                    key={activity.id}
                    style={[styles.activityCard, pbLabel && styles.activityCardBest]}
                  >
                    {/* Main row */}
                    <View style={styles.activityRow}>
                      <Text style={styles.icon}>{ACTIVITY_ICONS[activity.activity_type] || '🏅'}</Text>
                      <View style={styles.activityInfo}>
                        {editingId === activity.id ? (
                          <View style={styles.nameEditRow}>
                            <TextInput
                              style={styles.nameInput}
                              value={editingName}
                              onChangeText={setEditingName}
                              autoFocus
                              onSubmitEditing={() => saveName(activity.id)}
                              onBlur={() => saveName(activity.id)}
                            />
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.typeRow} onPress={() => startEditing(activity)}>
                            <Text style={styles.activityType}>{activity.name || activity.activity_type}</Text>
                            <Text style={styles.editPencil}>✏️</Text>
                            <Text style={styles.multiplier}>×{multiplier}</Text>
                            {pbLabel && <Text style={styles.bestBadge}>🔥 {pbLabel}</Text>}
                          </TouchableOpacity>
                        )}
                        <Text style={styles.activityMeta}>
                          {activity.activity_type} · {formatDate(activity.started_at)} · {formatDuration(activity.duration_seconds)}
                          {distance ? ` · ${distance}` : ''}
                        </Text>
                      </View>
                      <View style={styles.rightCol}>
                        <Text style={styles.points}>{activity.effort_score} pts</Text>
                        <TouchableOpacity
                          style={styles.cameraBtn}
                          onPress={() => uploadPhoto(activity.id)}
                          disabled={isUploading}
                        >
                          <Text style={styles.cameraBtnText}>{isUploading ? '⏳' : '📷'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Photo */}
                    {activity.photo_url && (
                      <Image
                        source={{ uri: activity.photo_url }}
                        style={styles.activityPhoto}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  header: { marginBottom: 24 },
  back: { color: '#E91E8C', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 16 },

  totalBanner: { backgroundColor: '#E91E8C', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', opacity: 0.85 },
  totalValue: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },

  emptyText: { color: '#999999', fontSize: 15, textAlign: 'center', paddingVertical: 24 },

  weekSection: { marginBottom: 28 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  weekLabel: { fontSize: 14, fontWeight: '700', color: '#999999', textTransform: 'uppercase', letterSpacing: 1 },
  weekTotal: { fontSize: 14, fontWeight: '700', color: '#E91E8C' },

  list: { gap: 10 },

  activityCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2A2A2A', gap: 12 },
  activityCardBest: { borderColor: '#fbbf24', backgroundColor: '#3b2a1a' },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { fontSize: 24 },
  activityInfo: { flex: 1, gap: 3 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  activityType: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  editPencil: { fontSize: 11 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center' },
  nameInput: { flex: 1, backgroundColor: '#222222', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: '#FFFFFF', fontSize: 15, fontWeight: '700', borderWidth: 1, borderColor: '#E91E8C' },
  multiplier: { fontSize: 12, fontWeight: '700', color: '#999999', backgroundColor: '#1A0A12', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  bestBadge: { fontSize: 11, fontWeight: '700', color: '#fbbf24', backgroundColor: '#422f10', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  activityMeta: { fontSize: 13, color: '#999999' },

  rightCol: { alignItems: 'flex-end', gap: 6 },
  points: { fontSize: 18, fontWeight: '800', color: '#E91E8C' },
  cameraBtn: { padding: 4 },
  cameraBtnText: { fontSize: 16 },

  activityPhoto: { width: '100%', height: 360, borderRadius: 8, backgroundColor: '#2A2A2A' },

  errorBanner: { backgroundColor: '#3b0a0a', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#f87171' },
  errorText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
});
