import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getLevel, xpProgressInLevel, LEVELS } from '../lib/xp';
import { calculateStreak, getStreakMultiplier, StreakResult } from '../lib/streak';

export default function ProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [email, setEmail] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalActivities, setTotalActivities] = useState(0);
  const [thisWeekPoints, setThisWeekPoints] = useState(0);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [totalElevationM, setTotalElevationM] = useState(0);
  const [streakBonusXp, setStreakBonusXp] = useState(0);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    setEmail(user.email ?? '');
    if (user.created_at) {
      const d = new Date(user.created_at);
      setMemberSince(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    }

    const [userRes, activitiesRes, stravaRes] = await Promise.all([
      supabase.from('users').select('display_name, is_admin, avatar_url').eq('id', user.id).single(),
      supabase.from('activities').select('effort_score, started_at, distance_meters, elevation_meters').eq('user_id', user.id),
      supabase.from('fitness_connections').select('id').eq('user_id', user.id).eq('provider', 'strava').maybeSingle(),
    ]);

    const name = userRes.data?.display_name || user.user_metadata?.display_name || '';
    setDisplayName(name);
    setNewName(name);
    setIsAdmin(!!userRes.data?.is_admin);
    setAvatarUrl(userRes.data?.avatar_url || null);
    setStravaConnected(!!stravaRes.data);

    const activities = activitiesRes.data || [];
    const total = activities.reduce((sum, a) => sum + (a.effort_score || 0), 0);
    setTotalPoints(Math.round(total * 10) / 10);
    setTotalActivities(activities.length);
    setTotalDistanceKm(Math.round(activities.reduce((sum, a) => sum + (a.distance_meters || 0), 0) / 1000));
    setTotalElevationM(Math.round(activities.reduce((sum, a) => sum + (a.elevation_meters || 0), 0)));

    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekTotal = activities
      .filter((a) => new Date(a.started_at) >= weekStart)
      .reduce((sum, a) => sum + (a.effort_score || 0), 0);
    setThisWeekPoints(Math.round(weekTotal * 10) / 10);

    const streak = calculateStreak(activities);
    setStreak(streak);
    const multiplier = getStreakMultiplier(streak.current);
    setStreakBonusXp(
      streak.activeThisWeek && multiplier > 1.0
        ? Math.round(weekTotal * (multiplier - 1.0))
        : 0
    );

    setLoading(false);
  }

  async function saveName() {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('users').update({ display_name: newName.trim() }).eq('id', user.id);
    await supabase.auth.updateUser({ data: { display_name: newName.trim() } });
    setDisplayName(newName.trim());
    setEditingName(false);
    setSaving(false);
  }

  async function uploadAvatar() {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/avatar.${ext}`;
        const { error: storageErr } = await supabase.storage
          .from('avatars')
          .upload(path, file, { contentType: file.type, upsert: true });
        if (!storageErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          await supabase.from('users').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
          setAvatarUrl(urlData.publicUrl);
        }
      } finally {
        setUploadingAvatar(false);
      }
    };
    input.click();
  }

  async function disconnectStrava() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('fitness_connections').delete().eq('user_id', user.id).eq('provider', 'strava');
    setStravaConnected(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const lvl = getLevel(totalPoints);
  const { current, needed, pct } = xpProgressInLevel(totalPoints);
  const isMax = lvl.maxXp === Infinity;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Hero identity block */}
        <View style={[styles.heroCard, { borderColor: lvl.color + '55' }]}>
          <TouchableOpacity onPress={uploadAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
            <View style={[styles.avatar, { borderColor: lvl.color, borderWidth: 3 }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {displayName ? displayName[0].toUpperCase() : '?'}
                </Text>
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditText}>{uploadingAvatar ? '⏳' : '📷'}</Text>
            </View>
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                autoCapitalize="words"
              />
              <TouchableOpacity style={styles.saveButton} onPress={saveName} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? '…' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setNewName(displayName); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)} style={styles.nameRow}>
              <Text style={styles.displayName}>{displayName || 'Set your name'}</Text>
              <Text style={styles.editHint}>✏️</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.rankName, { color: lvl.color }]}>{lvl.name}</Text>
          <View style={[styles.levelPill, { backgroundColor: lvl.color + '22', borderColor: lvl.color + '55' }]}>
            <Text style={[styles.levelPillText, { color: lvl.color }]}>Level {lvl.level} · {Math.round(totalPoints)} XP</Text>
          </View>

          {!isMax && (
            <View style={styles.xpSection}>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: lvl.color }]} />
              </View>
              <Text style={styles.xpToNext}>{needed - current} XP to {LEVELS[lvl.level]?.name ?? 'max'}</Text>
            </View>
          )}
          {isMax && <Text style={[styles.xpToNext, { color: lvl.color, marginTop: 8 }]}>You are Unrivaled.</Text>}

          <Text style={styles.email}>{email}</Text>
          {memberSince ? <Text style={styles.memberSince}>Member since {memberSince}</Text> : null}
        </View>

        {/* Stats row 1 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{thisWeekPoints}</Text>
            <Text style={styles.statLabel}>This week</Text>
            {streakBonusXp > 0 && (
              <Text style={styles.streakBonus}>🔥 +{streakBonusXp}</Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(totalPoints)}</Text>
            <Text style={styles.statLabel}>All-time XP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalActivities}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
        </View>

        {/* Stats row 2 */}
        <View style={[styles.statsGrid, { marginBottom: 20 }]}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#8DC63F' }]}>
              {totalDistanceKm.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>km logged</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#8DC63F' }]}>
              {totalElevationM.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>m climbed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { fontSize: 16 }]}>{memberSince || '—'}</Text>
            <Text style={styles.statLabel}>Member since</Text>
          </View>
        </View>

        {/* Streak bonus card */}
        {(() => {
          const currentStreak = streak?.current ?? 0;
          const multiplier = getStreakMultiplier(currentStreak);
          const tiers = [
            { weeks: 2,  label: '2 weeks',  mult: 1.05 },
            { weeks: 4,  label: '4 weeks',  mult: 1.10 },
            { weeks: 8,  label: '8 weeks',  mult: 1.15 },
            { weeks: 12, label: '12 weeks', mult: 1.20 },
          ];
          return (
            <View style={styles.streakCard}>
              <View style={styles.streakCardHeader}>
                <Text style={styles.streakCardTitle}>🔥 Streak Bonus</Text>
                <View style={styles.streakCurrentPill}>
                  <Text style={styles.streakCurrentText}>
                    {currentStreak > 0 ? `${currentStreak}w streak` : 'No streak'}
                  </Text>
                </View>
              </View>

              <Text style={styles.streakCardSub}>
                Complete at least 3 activities every week to build your streak and earn bonus XP on top of your weekly score.
              </Text>

              <View style={styles.streakTiers}>
                {tiers.map((tier) => {
                  const isActive = currentStreak >= tier.weeks;
                  const isNext = !isActive && currentStreak < tier.weeks &&
                    (tier === tiers.find(t => currentStreak < t.weeks));
                  return (
                    <View
                      key={tier.weeks}
                      style={[styles.streakTierRow, isActive && styles.streakTierRowActive]}
                    >
                      <Text style={[styles.streakTierWeeks, isActive && { color: '#E91E8C' }]}>
                        {isActive ? '✓' : isNext ? '→' : '  '} {tier.label}
                      </Text>
                      <Text style={[styles.streakTierMult, isActive && { color: '#E91E8C' }]}>
                        +{Math.round((tier.mult - 1) * 100)}% XP
                      </Text>
                    </View>
                  );
                })}
              </View>

              {multiplier > 1.0 && (
                <View style={styles.streakActiveRow}>
                  <Text style={styles.streakActiveText}>
                    You're earning <Text style={{ color: '#E91E8C', fontWeight: '900' }}>+{Math.round((multiplier - 1) * 100)}%</Text> bonus XP this week
                  </Text>
                </View>
              )}
              {multiplier === 1.0 && currentStreak === 0 && (
                <Text style={styles.streakNudge}>Log 3 activities this week to start your streak.</Text>
              )}
              {multiplier === 1.0 && currentStreak === 1 && (
                <Text style={styles.streakNudge}>One more qualifying week and your bonus kicks in.</Text>
              )}
            </View>
          );
        })()}

        {/* Ranks + Achievements */}
        <View style={styles.quickLinks}>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/ranks')}>
            <Text style={styles.quickLinkIcon}>🏆</Text>
            <Text style={styles.quickLinkText}>All ranks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/achievements')}>
            <Text style={styles.quickLinkIcon}>🏅</Text>
            <Text style={styles.quickLinkText}>Achievements</Text>
          </TouchableOpacity>
        </View>

        {stravaConnected && (
          <TouchableOpacity style={styles.disconnectButton} onPress={disconnectStrava}>
            <Text style={styles.disconnectText}>Disconnect Strava</Text>
          </TouchableOpacity>
        )}

        {isAdmin && (
          <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/admin')}>
            <Text style={styles.adminButtonText}>⚙️ Scoring Config</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#999999', fontSize: 16 },
  header: { marginBottom: 24 },
  back: { color: '#E91E8C', fontSize: 16 },

  heroCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E91E8C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#E91E8C', borderRadius: 12, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1A1A1A' },
  avatarEditText: { fontSize: 12 },
  avatarText: { fontSize: 36, fontWeight: '900', color: '#FFFFFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  editHint: { fontSize: 16 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    backgroundColor: '#222222',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#E91E8C',
    minWidth: 160,
  },
  saveButton: { backgroundColor: '#E91E8C', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  cancelText: { color: '#999999', fontSize: 14 },
  email: { fontSize: 13, color: '#666666' },
  memberSince: { fontSize: 12, color: '#555555', marginTop: -4 },

  rankName: { fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  levelPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  levelPillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  xpSection: { width: '100%', gap: 6, marginTop: 4 },
  xpTrack: { height: 8, backgroundColor: '#2A2A2A', borderRadius: 4, width: '100%' },
  xpFill: { height: '100%', borderRadius: 4 },
  xpToNext: { fontSize: 12, color: '#999999', textAlign: 'center' },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  statLabel: { fontSize: 10, color: '#666666', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  streakBonus: { fontSize: 10, color: '#E91E8C', fontWeight: '700' },

  streakCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 14,
  },
  streakCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakCardTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  streakCurrentPill: {
    backgroundColor: '#E91E8C22',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E91E8C55',
  },
  streakCurrentText: { fontSize: 12, fontWeight: '700', color: '#E91E8C' },
  streakCardSub: { fontSize: 12, color: '#666666', lineHeight: 18 },
  streakTiers: { gap: 8 },
  streakTierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#111111',
  },
  streakTierRowActive: { backgroundColor: '#1A0A12', borderWidth: 1, borderColor: '#E91E8C33' },
  streakTierWeeks: { fontSize: 13, color: '#555555', fontWeight: '600' },
  streakTierMult: { fontSize: 13, color: '#555555', fontWeight: '800' },
  streakActiveRow: {
    backgroundColor: '#E91E8C11',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E91E8C33',
  },
  streakActiveText: { fontSize: 13, color: '#CCCCCC', textAlign: 'center' },
  streakNudge: { fontSize: 12, color: '#555555', textAlign: 'center' },

  quickLinks: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: 6 },
  quickLink: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  quickLinkIcon: { fontSize: 22 },
  quickLinkText: { color: '#999999', fontSize: 13, fontWeight: '600' },

  disconnectButton: {
    borderWidth: 1,
    borderColor: '#fc4c02',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  disconnectText: { color: '#fc4c02', fontSize: 16, fontWeight: '700' },

  adminButton: {
    borderWidth: 1,
    borderColor: '#E91E8C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  adminButtonText: { color: '#E91E8C', fontSize: 16, fontWeight: '700' },

  signOutButton: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
});
