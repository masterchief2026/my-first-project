import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const ACTIVITY_ICONS: Record<string, string> = {
  Run: '🏃', Ride: '🚴', Swim: '🏊', WeightTraining: '🏋️',
  Workout: '💪', Hike: '🥾', Walk: '🚶', Yoga: '🧘',
  CrossFit: '🤸', Rowing: '🚣', Hyrox: '🔥', HIIT: '⚡',
  AlpineSki: '⛷️', NordicSki: '🎿', VirtualRide: '🚴', VirtualRun: '🏃',
};

// Class-based types use sessions (1 session = 45 min) instead of free duration entry
const SESSION_TYPES = new Set([
  'WeightTraining', 'CrossFit', 'Hyrox', 'HIIT', 'Workout', 'Yoga',
]);
const SESSION_MINUTES = 45;

type PlannedActivity = {
  id: string;
  activity_type: string;
  duration_minutes: number;
  projected_xp: number;
};

type LeagueStanding = {
  league_id: string;
  league_name: string;
  currentRank: number;
  projectedRank: number;
  myCurrentScore: number;
  myProjectedScore: number;
  members: { user_id: string; name: string; score: number }[];
};

function getMondayStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function PlanScreen() {
  const [userId, setUserId] = useState('');
  const [scoringConfig, setScoringConfig] = useState<Record<string, number>>({});
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [currentWeekXp, setCurrentWeekXp] = useState(0);
  const [plannedActivities, setPlannedActivities] = useState<PlannedActivity[]>([]);
  const [leagues, setLeagues] = useState<LeagueStanding[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState('Run');
  const [duration, setDuration] = useState('');
  const [sessions, setSessions] = useState(1);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const weekStart = getMondayStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const [configRes, activitiesRes, membershipsRes] = await Promise.all([
      supabase.from('scoring_config').select('activity_type, multiplier'),
      supabase.from('activities').select('effort_score, started_at')
        .eq('user_id', user.id)
        .gte('started_at', weekStart.toISOString())
        .lt('started_at', weekEnd.toISOString()),
      supabase.from('league_members').select('league_id, leagues(id, name)').eq('user_id', user.id),
    ]);

    // Build scoring map
    const config: Record<string, number> = {};
    for (const row of configRes.data || []) {
      config[row.activity_type] = row.multiplier;
    }
    setScoringConfig(config);
    setActivityTypes(Object.keys(config).sort());

    // Current week XP
    const weekTotal = (activitiesRes.data || []).reduce((s, a) => s + (a.effort_score || 0), 0);
    setCurrentWeekXp(Math.round(weekTotal * 10) / 10);

    // League standings
    const leagueMemberships = (membershipsRes.data || []).map((m: any) => m.leagues).filter(Boolean);
    const leagueStandings: LeagueStanding[] = await Promise.all(
      leagueMemberships.map(async (league: any) => {
        const { data: membersData } = await supabase
          .from('league_members').select('user_id, users(display_name, email)').eq('league_id', league.id);

        const members = await Promise.all(
          (membersData || []).map(async (m: any) => {
            const { data: acts } = await supabase
              .from('activities').select('effort_score')
              .eq('user_id', m.user_id)
              .gte('started_at', weekStart.toISOString())
              .lt('started_at', weekEnd.toISOString());
            const score = (acts || []).reduce((s, a) => s + (a.effort_score || 0), 0);
            const name = m.users?.display_name || m.users?.email?.split('@')[0] || 'Athlete';
            return { user_id: m.user_id, name, score: Math.round(score * 10) / 10 };
          })
        );

        const sorted = [...members].sort((a, b) => b.score - a.score);
        const currentRank = sorted.findIndex((m) => m.user_id === user.id) + 1;
        const myScore = members.find((m) => m.user_id === user.id)?.score ?? 0;

        return {
          league_id: league.id,
          league_name: league.name,
          currentRank,
          projectedRank: currentRank,
          myCurrentScore: myScore,
          myProjectedScore: myScore,
          members: sorted,
        };
      })
    );

    setLeagues(leagueStandings);
    setLoading(false);
  }

  function estimateXp(type: string, durationMins: number): number {
    const multiplier = scoringConfig[type] ?? 1.0;
    return Math.round(durationMins * multiplier * 10) / 10;
  }

  function isSessionType(type: string) { return SESSION_TYPES.has(type); }

  function addPlanned() {
    const isSession = isSessionType(selectedType);
    const mins = isSession ? sessions * SESSION_MINUTES : parseFloat(duration);
    if (!mins || mins <= 0) return;
    const xp = estimateXp(selectedType, mins);
    const newActivity: PlannedActivity = {
      id: Date.now().toString(),
      activity_type: selectedType,
      duration_minutes: mins,
      projected_xp: xp,
    };
    const next = [...plannedActivities, newActivity];
    setPlannedActivities(next);
    setDuration('');
    setSessions(1);
    updateLeagueProjections(next);
    // stay open for more
  }

  function closeAddModal() {
    setShowAdd(false);
    setDuration('');
    setSessions(1);
  }

  function removePlanned(id: string) {
    const remaining = plannedActivities.filter((a) => a.id !== id);
    setPlannedActivities(remaining);
    updateLeagueProjections(remaining);
  }

  function updateLeagueProjections(planned: PlannedActivity[]) {
    const bonusXp = planned.reduce((s, a) => s + a.projected_xp, 0);
    setLeagues((prev) => prev.map((league) => {
      const myProjected = league.myCurrentScore + bonusXp;
      const projected = league.members.map((m) =>
        m.user_id === userId ? { ...m, score: myProjected } : m
      ).sort((a, b) => b.score - a.score);
      const projectedRank = projected.findIndex((m) => m.user_id === userId) + 1;
      return { ...league, myProjectedScore: Math.round(myProjected * 10) / 10, projectedRank };
    }));
  }

  const totalPlannedXp = plannedActivities.reduce((s, a) => s + a.projected_xp, 0);
  const projectedTotal = Math.round((currentWeekXp + totalPlannedXp) * 10) / 10;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Plan Your Week</Text>
        <Text style={styles.subtitle}>Add workouts you're planning to see your projected league position.</Text>

        {/* Current vs projected XP */}
        <View style={styles.xpCard}>
          <View style={styles.xpBlock}>
            <Text style={styles.xpBlockLabel}>Earned so far</Text>
            <Text style={styles.xpBlockValue}>{currentWeekXp}</Text>
            <Text style={styles.xpBlockUnit}>XP</Text>
          </View>
          <View style={styles.xpDivider} />
          <View style={styles.xpBlock}>
            <Text style={styles.xpBlockLabel}>Planned</Text>
            <Text style={[styles.xpBlockValue, { color: '#8DC63F' }]}>+{Math.round(totalPlannedXp * 10) / 10}</Text>
            <Text style={styles.xpBlockUnit}>XP</Text>
          </View>
          <View style={styles.xpDivider} />
          <View style={styles.xpBlock}>
            <Text style={styles.xpBlockLabel}>Projected</Text>
            <Text style={[styles.xpBlockValue, { color: '#E91E8C' }]}>{projectedTotal}</Text>
            <Text style={styles.xpBlockUnit}>XP</Text>
          </View>
        </View>

        {/* Planned activities */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Planned workouts</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {plannedActivities.length === 0 && (
          <View style={styles.emptyPlanned}>
            <Text style={styles.emptyPlannedText}>No workouts planned yet.</Text>
            <Text style={styles.emptyPlannedSub}>Add a workout to see your projected standing.</Text>
          </View>
        )}

        {plannedActivities.map((a) => (
          <View key={a.id} style={styles.plannedRow}>
            <Text style={styles.plannedIcon}>{ACTIVITY_ICONS[a.activity_type] ?? '🏅'}</Text>
            <View style={styles.plannedInfo}>
              <Text style={styles.plannedType}>{a.activity_type}</Text>
              <Text style={styles.plannedMeta}>{a.duration_minutes} min · ×{scoringConfig[a.activity_type] ?? 1.0}</Text>
            </View>
            <Text style={styles.plannedXp}>+{a.projected_xp} XP</Text>
            <TouchableOpacity onPress={() => removePlanned(a.id)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* League impact */}
        {leagues.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 28, marginBottom: 12 }]}>League impact</Text>
            {leagues.map((league) => {
              const moved = league.projectedRank < league.currentRank;
              const dropped = league.projectedRank > league.currentRank;
              const same = league.projectedRank === league.currentRank;
              return (
                <View key={league.league_id} style={styles.leagueCard}>
                  <View style={styles.leagueCardHeader}>
                    <Text style={styles.leagueName}>{league.league_name}</Text>
                    <View style={styles.rankChangeBlock}>
                      {same && totalPlannedXp === 0 && (
                        <Text style={styles.rankSame}>—</Text>
                      )}
                      {same && totalPlannedXp > 0 && (
                        <Text style={styles.rankSame}>P{league.currentRank} → P{league.projectedRank}</Text>
                      )}
                      {moved && (
                        <Text style={styles.rankUp}>↑ P{league.currentRank} → P{league.projectedRank}</Text>
                      )}
                      {dropped && (
                        <Text style={styles.rankDown}>↓ P{league.currentRank} → P{league.projectedRank}</Text>
                      )}
                    </View>
                  </View>

                  {/* Mini leaderboard preview */}
                  <View style={styles.miniLeaderboard}>
                    {league.members.slice(0, 5).map((member, idx) => {
                      const isMe = member.user_id === userId;
                      const projScore = isMe ? league.myProjectedScore : member.score;
                      return (
                        <View key={member.user_id} style={[styles.miniRow, isMe && styles.miniRowMe]}>
                          <Text style={styles.miniRank}>{idx + 1}.</Text>
                          <Text style={[styles.miniName, isMe && { color: '#FFFFFF', fontWeight: '800' }]}>
                            {isMe ? 'You' : member.name}
                          </Text>
                          <View style={styles.miniScoreBlock}>
                            <Text style={[styles.miniScore, isMe && { color: '#E91E8C' }]}>
                              {Math.round(projScore * 10) / 10} pts
                            </Text>
                            {isMe && totalPlannedXp > 0 && (
                              <Text style={styles.miniBonus}>+{Math.round(totalPlannedXp * 10) / 10}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                    {league.members.length > 5 && (
                      <Text style={styles.moreMembers}>+{league.members.length - 5} more</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {!loading && leagues.length === 0 && (
          <View style={styles.noLeagues}>
            <Text style={styles.noLeaguesText}>Join a league to see your projected position here.</Text>
          </View>
        )}

        <Text style={styles.disclaimer}>* XP estimates based on duration × scoring multiplier. Actual XP may vary slightly.</Text>

      </ScrollView>

      {/* Add Workout Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan workouts</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={closeAddModal}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Activity type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={styles.typeRow}>
              {activityTypes.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, selectedType === t && styles.typeChipActive]}
                  onPress={() => setSelectedType(t)}
                >
                  <Text style={[styles.typeChipText, selectedType === t && styles.typeChipTextActive]}>
                    {ACTIVITY_ICONS[t] ?? '🏅'} {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isSessionType(selectedType) ? (
              <>
                <Text style={styles.modalLabel}>Sessions</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setSessions((s) => Math.max(1, s - 1))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.stepperValueBlock}>
                    <Text style={styles.stepperValue}>{sessions}</Text>
                    <Text style={styles.stepperSub}>{sessions === 1 ? 'session' : 'sessions'} · {sessions * SESSION_MINUTES} min total</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setSessions((s) => s + 1)}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Estimated XP</Text>
                  <Text style={styles.previewXp}>+{estimateXp(selectedType, sessions * SESSION_MINUTES)} XP</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalLabel}>Duration (minutes)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 45"
                  placeholderTextColor="#555555"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="decimal-pad"
                />
                {duration && parseFloat(duration) > 0 && (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Estimated XP</Text>
                    <Text style={styles.previewXp}>+{estimateXp(selectedType, parseFloat(duration))} XP</Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.addWorkoutBtn, (!isSessionType(selectedType) && (!duration || parseFloat(duration) <= 0)) && styles.saveBtnDisabled]}
              onPress={addPlanned}
              disabled={!isSessionType(selectedType) && (!duration || parseFloat(duration) <= 0)}
            >
              <Text style={styles.addWorkoutBtnText}>+ Add to plan</Text>
            </TouchableOpacity>

            {/* Running list inside modal */}
            {plannedActivities.length > 0 && (
              <>
                <View style={styles.modalDivider} />
                <Text style={styles.modalLabel}>Added so far</Text>
                {plannedActivities.map((a) => (
                  <View key={a.id} style={styles.modalPlannedRow}>
                    <Text style={styles.modalPlannedIcon}>{ACTIVITY_ICONS[a.activity_type] ?? '🏅'}</Text>
                    <View style={styles.modalPlannedInfo}>
                      <Text style={styles.modalPlannedType}>{a.activity_type}</Text>
                      <Text style={styles.modalPlannedMeta}>
                        {isSessionType(a.activity_type)
                          ? `${a.duration_minutes / SESSION_MINUTES} session${a.duration_minutes / SESSION_MINUTES === 1 ? '' : 's'} · ${a.duration_minutes} min`
                          : `${a.duration_minutes} min`}
                      </Text>
                    </View>
                    <Text style={styles.modalPlannedXp}>+{a.projected_xp} XP</Text>
                    <TouchableOpacity onPress={() => removePlanned(a.id)}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total planned</Text>
                  <Text style={styles.modalTotalXp}>+{Math.round(totalPlannedXp * 10) / 10} XP</Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  header: { marginBottom: 24 },
  back: { color: '#E91E8C', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666666', marginBottom: 24, lineHeight: 20 },

  xpCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  xpBlock: { flex: 1, alignItems: 'center', gap: 2 },
  xpBlockLabel: { fontSize: 11, color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5 },
  xpBlockValue: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  xpBlockUnit: { fontSize: 11, color: '#555555', fontWeight: '600' },
  xpDivider: { width: 1, height: 48, backgroundColor: '#2A2A2A' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  addBtn: { backgroundColor: '#E91E8C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  emptyPlanned: { paddingVertical: 28, alignItems: 'center', gap: 6 },
  emptyPlannedText: { fontSize: 14, color: '#555555' },
  emptyPlannedSub: { fontSize: 12, color: '#444444' },

  plannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#8DC63F33',
  },
  plannedIcon: { fontSize: 22 },
  plannedInfo: { flex: 1, gap: 2 },
  plannedType: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  plannedMeta: { fontSize: 12, color: '#666666' },
  plannedXp: { fontSize: 16, fontWeight: '800', color: '#8DC63F' },
  removeBtn: { padding: 4 },
  removeBtnText: { color: '#444444', fontSize: 16 },

  leagueCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 12,
  },
  leagueCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leagueName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  rankChangeBlock: {},
  rankUp: { fontSize: 14, fontWeight: '800', color: '#4ade80' },
  rankDown: { fontSize: 14, fontWeight: '800', color: '#f87171' },
  rankSame: { fontSize: 13, color: '#555555' },

  miniLeaderboard: { gap: 6 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  miniRowMe: {
    backgroundColor: '#1A0A12',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderWidth: 1,
    borderColor: '#E91E8C33',
  },
  miniRank: { fontSize: 13, color: '#555555', width: 20 },
  miniName: { flex: 1, fontSize: 13, color: '#999999' },
  miniScoreBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniScore: { fontSize: 13, fontWeight: '700', color: '#999999' },
  miniBonus: { fontSize: 11, color: '#8DC63F', fontWeight: '700' },
  moreMembers: { fontSize: 12, color: '#444444', textAlign: 'center', paddingTop: 4 },

  noLeagues: { paddingVertical: 24, alignItems: 'center' },
  noLeaguesText: { fontSize: 14, color: '#555555', textAlign: 'center' },

  disclaimer: { fontSize: 11, color: '#3A3A3A', textAlign: 'center', marginTop: 24, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '90%' },
  modalCard: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  doneBtn: { backgroundColor: '#E91E8C', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  doneBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#666666', textTransform: 'uppercase', letterSpacing: 1 },
  typeScroll: { flexGrow: 0 },
  typeRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#222222' },
  typeChipActive: { backgroundColor: '#E91E8C', borderColor: '#E91E8C' },
  typeChipText: { fontSize: 13, color: '#666666', fontWeight: '600' },
  typeChipTextActive: { color: '#FFFFFF' },
  modalInput: { backgroundColor: '#222222', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 18, borderWidth: 1, borderColor: '#2A2A2A' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#8DC63F11', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#8DC63F33' },
  previewLabel: { fontSize: 13, color: '#999999' },
  previewXp: { fontSize: 18, fontWeight: '900', color: '#8DC63F' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#222222', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', padding: 8, marginBottom: 12 },
  stepperBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 26 },
  stepperValueBlock: { alignItems: 'center', flex: 1 },
  stepperValue: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  stepperSub: { fontSize: 12, color: '#666666', marginTop: 2 },
  addWorkoutBtn: { backgroundColor: '#8DC63F', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  addWorkoutBtnText: { color: '#111111', fontSize: 16, fontWeight: '800' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalDivider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 4 },
  modalPlannedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  modalPlannedIcon: { fontSize: 18 },
  modalPlannedInfo: { flex: 1 },
  modalPlannedType: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  modalPlannedMeta: { fontSize: 12, color: '#555555' },
  modalPlannedXp: { fontSize: 14, fontWeight: '700', color: '#8DC63F' },
  modalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  modalTotalLabel: { fontSize: 13, color: '#666666', fontWeight: '600' },
  modalTotalXp: { fontSize: 16, fontWeight: '900', color: '#8DC63F' },
});
