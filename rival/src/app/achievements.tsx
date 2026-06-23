import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ACHIEVEMENTS, CATEGORY_LABELS, checkAchievements } from '../lib/achievements';
import { calculateStreak } from '../lib/streak';

export default function AchievementsScreen() {
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newlyEarned, setNewlyEarned] = useState<string[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: activities } = await supabase
      .from('activities')
      .select('activity_type, distance_meters, elevation_meters, effort_score')
      .eq('user_id', user.id);

    const totalXp = (activities || []).reduce((s, a) => s + (a.effort_score || 0), 0);
    const streak = calculateStreak(activities || []);
    const calculated = checkAchievements(activities || [], totalXp, streak.longestEver);

    // Load already-saved achievements
    const { data: saved } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', user.id);

    const savedIds = new Set((saved || []).map((r: any) => r.achievement_id));

    // Find newly earned ones not yet saved
    const toSave = calculated.filter((id) => !savedIds.has(id));
    if (toSave.length > 0) {
      await supabase.from('user_achievements').insert(
        toSave.map((achievement_id) => ({ user_id: user.id, achievement_id }))
      );
      setNewlyEarned(toSave);
    }

    setEarnedIds(new Set(calculated));
    setLoading(false);
  }

  const categories = ['firsts', 'streak', 'activities', 'distance', 'elevation', 'rank'];
  const earnedCount = ACHIEVEMENTS.filter((a) => earnedIds.has(a.id)).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Achievements</Text>
        <Text style={styles.subtitle}>{earnedCount} of {ACHIEVEMENTS.length} unlocked</Text>

        {newlyEarned.length > 0 && (
          <View style={styles.newBanner}>
            <Text style={styles.newBannerTitle}>New unlocks!</Text>
            <Text style={styles.newBannerSub}>
              {newlyEarned.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).join(', ')}
            </Text>
          </View>
        )}

        {loading && <Text style={styles.emptyText}>Loading…</Text>}

        {!loading && categories.map((cat) => {
          const items = ACHIEVEMENTS.filter((a) => a.category === cat);
          return (
            <View key={cat} style={styles.section}>
              <Text style={styles.sectionTitle}>{CATEGORY_LABELS[cat]}</Text>
              <View style={styles.grid}>
                {items.map((achievement) => {
                  const earned = earnedIds.has(achievement.id);
                  const isNew = newlyEarned.includes(achievement.id);
                  return (
                    <View
                      key={achievement.id}
                      style={[
                        styles.badge,
                        earned ? styles.badgeEarned : styles.badgeLocked,
                        isNew && styles.badgeNew,
                      ]}
                    >
                      <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                        {earned ? achievement.icon : '🔒'}
                      </Text>
                      <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                        {achievement.name}
                      </Text>
                      <Text style={[styles.badgeDesc, !earned && styles.badgeDescLocked]}>
                        {achievement.desc}
                      </Text>
                      {isNew && <View style={styles.newDot} />}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  header: { marginBottom: 24 },
  back: { color: '#E91E8C', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#999999', marginBottom: 24 },
  newBanner: {
    backgroundColor: '#fbbf2420',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf2440',
    padding: 14,
    marginBottom: 24,
    gap: 4,
  },
  newBannerTitle: { fontSize: 15, fontWeight: '800', color: '#fbbf24' },
  newBannerSub: { fontSize: 13, color: '#fcd34d' },
  emptyText: { color: '#999999', textAlign: 'center', paddingVertical: 24 },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    position: 'relative',
  },
  badgeEarned: {
    backgroundColor: '#111111',
    borderColor: '#E91E8C',
  },
  badgeLocked: {
    backgroundColor: '#1E1E1E',
    borderColor: '#2A2A2A',
  },
  badgeNew: {
    borderColor: '#fbbf24',
    backgroundColor: '#fbbf2411',
  },
  badgeIcon: { fontSize: 28 },
  badgeIconLocked: { opacity: 0.3 },
  badgeName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  badgeNameLocked: { color: '#444444' },
  badgeDesc: {
    fontSize: 10,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 14,
  },
  badgeDescLocked: { color: '#444444' },
  newDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
  },
});
