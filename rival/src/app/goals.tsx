import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const GYM_TYPES = new Set(['WeightTraining', 'CrossFit', 'Hyrox', 'HIIT', 'Workout']);

// Groups indoor + outdoor variants of the same sport together
const ACTIVITY_TYPE_GROUPS: Record<string, string[]> = {
  Run:  ['Run', 'VirtualRun', 'TrailRun'],
  Ride: ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'Handcycle'],
  Swim: ['Swim', 'IndoorSwim', 'OpenWaterSwim'],
  Walk: ['Walk'],
  Hike: ['Hike'],
};

type Goal = {
  id: string;
  goal_type: 'distance' | 'elevation' | 'gym_sessions';
  target_value: number;
  period_type: 'week' | 'month' | 'custom';
  start_date: string;
  end_date: string;
  activity_filter: string | null;
  progress: number;
};

const GOAL_LABELS: Record<string, string> = {
  distance: 'Distance',
  elevation: 'Elevation',
  gym_sessions: 'Gym Sessions',
};

const GOAL_UNITS: Record<string, string> = {
  distance: 'km',
  elevation: 'm',
  gym_sessions: 'sessions',
};

const GOAL_ABBR: Record<string, string> = {
  distance: 'KM',
  elevation: 'ELEV',
  gym_sessions: 'GYM',
};

const GOAL_BAR_COLOR: Record<string, string> = {
  distance: '#8DC63F',
  elevation: '#2563eb',
  gym_sessions: '#E91E8C',
};

// Activity types available as filters, with display names
const DISTANCE_FILTERS = [
  { value: null, label: 'All' },
  { value: 'Run', label: 'Run' },
  { value: 'Ride', label: 'Ride' },
  { value: 'Swim', label: 'Swim' },
  { value: 'Walk', label: 'Walk' },
  { value: 'Hike', label: 'Hike' },
];

const ELEVATION_FILTERS = [
  { value: null, label: 'All' },
  { value: 'Run', label: 'Run' },
  { value: 'Ride', label: 'Ride' },
  { value: 'Hike', label: 'Hike' },
];

function activityLabel(filter: string | null) {
  if (!filter) return 'All activities';
  return filter;
}

function getMondayStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNiceInterval(target: number): number {
  const niceNumbers = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  const rough = target / 8;
  return niceNumbers.find((n) => n >= rough) ?? niceNumbers[niceNumbers.length - 1];
}

const ZERO_MESSAGES = [
  "Let's do this! Time to get moving.",
  "You got this. First one's always the hardest.",
  "Goal set. Now go earn it.",
  "Ready when you are. Let's get it.",
  "Today's the day. No better time than now.",
  "Your future self will thank you.",
  "Go get those endorphins!",
];

function getEncouragement(progress: number, target: number, unit: string, goalId: string): string | null {
  const pct = progress / target;
  if (pct <= 0) {
    // Pick a consistent message per goal using the id
    const idx = goalId.charCodeAt(0) % ZERO_MESSAGES.length;
    return ZERO_MESSAGES[idx];
  }
  const remaining = Math.round((target - progress) * 10) / 10;
  if (remaining <= 0) return null;
  if (remaining <= target * 0.05) return `Almost there — just ${remaining} ${unit} to go!`;
  if (remaining <= target * 0.15) return `So close! Only ${remaining} ${unit} left.`;
  if (pct >= 0.75) return `Nearly there — ${remaining} ${unit} to go. Keep pushing!`;
  if (pct >= 0.5) return `Great work, you're over halfway! ${remaining} ${unit} remaining.`;
  if (pct >= 0.25) return `Good progress! ${remaining} ${unit} to go.`;
  return `Keep it up — ${remaining} ${unit} to go!`;
}

function ProgressBar({
  progress,
  target,
  color,
  unit,
}: {
  progress: number;
  target: number;
  color: string;
  unit: string;
}) {
  const rawPct = progress / target;
  const pct = Math.min(rawPct, 1);
  const displayPct = Math.round(pct * 100);
  const done = rawPct >= 1;

  // Thumb: at 0% pin to left edge, at 100% pin to right edge, otherwise center on position
  const thumbStyle = done
    ? { right: 0, left: undefined as any, marginLeft: 0 }
    : pct === 0
    ? { left: 0 as any, marginLeft: 0 }
    : { left: `${pct * 100}%` as any, marginLeft: -9 };

  const interval = getNiceInterval(target);
  const checkpoints: number[] = [];
  for (let v = interval; v < target; v += interval) {
    checkpoints.push(v);
  }

  return (
    <View style={styles.barContainer}>
      {checkpoints.length > 0 && (
        <View style={styles.checkpointLabelRow}>
          {checkpoints.map((cp) => {
            const cpPct = (cp / target) * 100;
            const reached = progress >= cp;
            return (
              <View key={cp} style={[styles.checkpointLabel, { left: `${cpPct}%` }]}>
                <Text style={[styles.checkpointLabelText, reached && { color }]}>
                  {cp >= 1000 ? `${cp / 1000}k` : cp}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: done ? '100%' : `${pct * 100}%`, backgroundColor: color }]} />

        {checkpoints.map((cp) => {
          const cpPct = (cp / target) * 100;
          const reached = progress >= cp;
          return (
            <View
              key={cp}
              style={[styles.tick, { left: `${cpPct}%`, backgroundColor: reached ? '#ffffff' : '#C0D8A0' }]}
            />
          );
        })}

        <View style={[styles.thumb, thumbStyle, { borderColor: done ? '#fbbf24' : color, backgroundColor: done ? '#fbbf24' : '#FFFFFF' }]} />
      </View>

      <View style={styles.barLabels}>
        <Text style={styles.barLabelStart}>0</Text>
        <Text style={[styles.barLabelProgress, { color: done ? '#fbbf24' : color }]}>{displayPct}%</Text>
        <Text style={styles.barLabelEnd}>{target}</Text>
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [userId, setUserId] = useState('');

  const [goalType, setGoalType] = useState<'distance' | 'elevation' | 'gym_sessions'>('distance');
  const [targetValue, setTargetValue] = useState('');
  const [periodType, setPeriodType] = useState<'week' | 'month' | 'custom'>('month');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activityFilter, setActivityFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!goalsData) { setLoading(false); return; }

    const { data: activities } = await supabase
      .from('activities')
      .select('activity_type, distance_meters, elevation_meters, started_at')
      .eq('user_id', user.id);

    const goalsWithProgress = goalsData.map((goal: any) => {
      const start = new Date(goal.start_date);
      const end = new Date(goal.end_date);
      end.setHours(23, 59, 59, 999);

      let relevant = (activities || []).filter((a: any) => {
        const d = new Date(a.started_at);
        return d >= start && d <= end;
      });

      if (goal.activity_filter) {
        const group = new Set(ACTIVITY_TYPE_GROUPS[goal.activity_filter] ?? [goal.activity_filter]);
        relevant = relevant.filter((a: any) => group.has(a.activity_type));
      }

      let progress = 0;
      if (goal.goal_type === 'distance') {
        progress = relevant.reduce((sum: number, a: any) => sum + (a.distance_meters || 0), 0) / 1000;
      } else if (goal.goal_type === 'elevation') {
        progress = relevant.reduce((sum: number, a: any) => sum + (a.elevation_meters || 0), 0);
      } else if (goal.goal_type === 'gym_sessions') {
        progress = relevant.filter((a: any) => GYM_TYPES.has(a.activity_type)).length;
      }

      return { ...goal, progress: Math.round(progress * 10) / 10 };
    });

    setGoals(goalsWithProgress);
    setLoading(false);
  }

  function getDateRange(period: 'week' | 'month' | 'custom') {
    const now = new Date();
    if (period === 'week') {
      const start = getMondayStart(now);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end };
    }
    if (period === 'month') {
      const start = getMonthStart(now);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    const start = now;
    const end = customEndDate ? new Date(customEndDate) : now;
    return { start, end };
  }

  async function saveGoal() {
    if (!targetValue || parseFloat(targetValue) <= 0) return;
    if (goals.length >= 3) return;
    if (periodType === 'custom' && !customEndDate) return;

    setSaving(true);
    const { start, end } = getDateRange(periodType);

    await supabase.from('goals').insert({
      user_id: userId,
      goal_type: goalType,
      target_value: parseFloat(targetValue),
      period_type: periodType,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      activity_filter: goalType === 'gym_sessions' ? null : activityFilter,
    });

    setSaving(false);
    setShowAdd(false);
    setTargetValue('');
    setPeriodType('month');
    setCustomEndDate('');
    setGoalType('distance');
    setActivityFilter(null);
    load();
  }

  async function deleteGoal(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this goal?')) return;
    await supabase.from('goals').delete().eq('id', id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  function periodLabel(goal: Goal) {
    if (goal.period_type === 'week') return 'This week';
    if (goal.period_type === 'month') return 'This month';
    return `${formatDate(goal.start_date)} – ${formatDate(goal.end_date)}`;
  }

  const filterOptions = goalType === 'elevation' ? ELEVATION_FILTERS : DISTANCE_FILTERS;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Goals</Text>
        <Text style={styles.subtitle}>Track what you're working towards.</Text>

        {loading && <Text style={styles.emptyText}>Loading…</Text>}

        {!loading && goals.length === 0 && (
          <Text style={styles.emptyText}>No goals yet. Set one below.</Text>
        )}

        {goals.map((goal) => {
          const color = GOAL_BAR_COLOR[goal.goal_type];
          const unit = GOAL_UNITS[goal.goal_type];
          const done = goal.progress >= goal.target_value;
          const encouragement = getEncouragement(goal.progress, goal.target_value, unit, goal.id);
          return (
            <View
              key={goal.id}
              style={[
                styles.goalCard,
                done && { borderColor: '#fbbf24', borderWidth: 1.5 },
              ]}
            >
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleRow}>
                  <View style={[styles.typeBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                    <Text style={[styles.typeBadgeText, { color }]}>{GOAL_ABBR[goal.goal_type]}</Text>
                  </View>
                  <View>
                    <Text style={styles.goalTitle}>{activityLabel(goal.activity_filter)}</Text>
                    <Text style={styles.goalPeriod}>
                      {GOAL_LABELS[goal.goal_type]} · {periodLabel(goal)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteGoal(goal.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {done && (
                <View style={styles.celebrationBanner}>
                  <Text style={styles.celebrationText}>Goal complete!</Text>
                  <Text style={styles.celebrationSub}>You crushed it. Set a new one to keep the momentum going.</Text>
                </View>
              )}

              <View style={styles.goalProgress}>
                <Text style={[styles.progressCurrent, done && { color: '#fbbf24' }]}>{goal.progress}</Text>
                <Text style={styles.progressSep}> / </Text>
                <Text style={styles.progressTarget}>{goal.target_value} {unit}</Text>
              </View>

              <ProgressBar
                progress={goal.progress}
                target={goal.target_value}
                color={color}
                unit={unit}
              />

              {!done && encouragement && (
                <Text style={styles.encouragement}>{encouragement}</Text>
              )}
            </View>
          );
        })}

        {goals.length < 3 && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAdd(true)}>
            <Text style={styles.addButtonText}>+ Add Goal</Text>
          </TouchableOpacity>
        )}

        {goals.length >= 3 && (
          <Text style={styles.maxText}>Maximum 3 goals. Delete one to add another.</Text>
        )}

      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>New Goal</Text>

            <Text style={styles.modalLabel}>Type</Text>
            <View style={styles.segmentRow}>
              {(['distance', 'elevation', 'gym_sessions'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segment, goalType === t && styles.segmentActive]}
                  onPress={() => { setGoalType(t); setActivityFilter(null); }}
                >
                  <Text style={[styles.segmentText, goalType === t && styles.segmentTextActive]}>
                    {GOAL_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {goalType !== 'gym_sessions' && (
              <>
                <Text style={styles.modalLabel}>Activity</Text>
                <View style={styles.segmentRow}>
                  {filterOptions.map((opt) => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[styles.segment, activityFilter === opt.value && styles.segmentActive]}
                      onPress={() => setActivityFilter(opt.value)}
                    >
                      <Text style={[styles.segmentText, activityFilter === opt.value && styles.segmentTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.modalLabel}>Target ({GOAL_UNITS[goalType]})</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={goalType === 'distance' ? '100' : goalType === 'elevation' ? '5000' : '12'}
              placeholderTextColor="#666666"
              value={targetValue}
              onChangeText={setTargetValue}
              keyboardType="decimal-pad"
            />

            <Text style={styles.modalLabel}>Period</Text>
            <View style={styles.segmentRow}>
              {(['week', 'month', 'custom'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.segment, periodType === p && styles.segmentActive]}
                  onPress={() => setPeriodType(p)}
                >
                  <Text style={[styles.segmentText, periodType === p && styles.segmentTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {periodType === 'custom' && (
              <>
                <Text style={styles.modalLabel}>End date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="2026-12-31"
                  placeholderTextColor="#666666"
                  value={customEndDate}
                  onChangeText={setCustomEndDate}
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowAdd(false); setTargetValue(''); setActivityFilter(null); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!targetValue || saving) && styles.saveButtonDisabled]}
                onPress={saveGoal}
                disabled={!targetValue || saving}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Goal'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  header: { marginBottom: 24 },
  back: { color: '#E91E8C', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#999999', marginBottom: 28 },
  emptyText: { color: '#999999', fontSize: 15, textAlign: 'center', paddingVertical: 24 },
  goalCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  goalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  goalTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  goalPeriod: { fontSize: 12, color: '#999999', marginTop: 2 },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#666666', fontSize: 12, fontWeight: '700' },
  celebrationBanner: {
    backgroundColor: '#fbbf2420',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fbbf2440',
    padding: 12,
    marginBottom: 14,
  },
  celebrationText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fbbf24',
    marginBottom: 2,
  },
  celebrationSub: {
    fontSize: 12,
    color: '#fcd34d',
    opacity: 0.8,
  },
  encouragement: {
    fontSize: 16,
    fontWeight: '700',
    color: '#999999',
    marginTop: 10,
    fontStyle: 'italic',
  },
  goalProgress: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  progressCurrent: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  progressSep: { color: '#666666', fontSize: 16 },
  progressTarget: { color: '#999999', fontSize: 15 },
  barContainer: { gap: 0 },
  checkpointLabelRow: {
    position: 'relative',
    height: 16,
    marginBottom: 2,
  },
  checkpointLabel: {
    position: 'absolute',
    transform: [{ translateX: -10 }],
  },
  checkpointLabelText: {
    fontSize: 9,
    color: '#8DC63F',
    fontWeight: '700',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 5,
    position: 'relative',
    overflow: 'visible',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    minWidth: 0,
  },
  tick: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    marginLeft: -1,
  },
  thumb: {
    position: 'absolute',
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    marginLeft: -9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  barLabelStart: { fontSize: 11, color: '#666666' },
  barLabelProgress: { fontSize: 11, fontWeight: '700' },
  barLabelEnd: { fontSize: 11, color: '#666666' },
  addButton: {
    backgroundColor: '#E91E8C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  maxText: { color: '#666666', fontSize: 13, textAlign: 'center', marginTop: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    maxHeight: '85%',
  },
  modalCard: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    gap: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#999999', textTransform: 'uppercase', letterSpacing: 1 },
  segmentRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#222222',
  },
  segmentActive: { backgroundColor: '#E91E8C', borderColor: '#E91E8C' },
  segmentText: { color: '#999999', fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#FFFFFF' },
  modalInput: {
    backgroundColor: '#222222',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cancelButtonText: { color: '#999999', fontSize: 16, fontWeight: '600' },
  saveButton: {
    flex: 2,
    backgroundColor: '#E91E8C',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
