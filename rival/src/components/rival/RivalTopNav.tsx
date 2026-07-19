import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getLevel } from '../../lib/xp';
import { getSeasonStartISO } from '../../lib/season';
import { RivalColors, RivalType, RANK_LEVEL_COLORS } from '../../constants/rivalTheme';

// Shared persistent top navigation, matching the Stitch mockups. Drop it in at
// the top of a screen (outside the ScrollView so it stays put) and pass the
// current section so it highlights. Self-contained: fetches the user's avatar
// itself so it needs no props beyond `active`.
type Section = 'today' | 'activity' | 'teams';

const LINKS: Array<{ key: Section; label: string; route: string }> = [
  { key: 'today', label: 'Today', route: '/home' },
  { key: 'activity', label: 'Activity', route: '/my-activities' },
  // Interim: no dedicated "your teams" list yet — points at Discover for now.
  { key: 'teams', label: 'Teams', route: '/discover-leagues' },
];

export function RivalTopNav({ active }: { active?: Section }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState('?');
  const [rankName, setRankName] = useState<string | null>(null);
  const [rankColor, setRankColor] = useState<string>(RivalColors.accentText);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: seasonActs }] = await Promise.all([
        supabase.from('users').select('avatar_url, display_name').eq('id', user.id).single(),
        // Rank = level from this season's Effort. Query only the season's rows
        // (bounded) rather than all-time, so the nav stays light on every screen.
        supabase.from('activities').select('effort_score').eq('user_id', user.id).gte('started_at', getSeasonStartISO()),
      ]);

      setAvatarUrl(profile?.avatar_url || null);
      const name = profile?.display_name || (user.user_metadata?.display_name as string) || '';
      setInitial(name ? name[0].toUpperCase() : '?');

      const seasonEffort = (seasonActs || []).reduce((s, a) => s + (a.effort_score || 0), 0);
      const lvl = getLevel(seasonEffort);
      setRankName(lvl.name);
      setRankColor(RANK_LEVEL_COLORS[lvl.level - 1] ?? RivalColors.accentText);
    })();
  }, []);

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => router.push('/home')}>
          <Text style={styles.logo}>RIVAL</Text>
        </TouchableOpacity>

        <View style={styles.links}>
          {LINKS.map((l) => (
            <TouchableOpacity key={l.key} onPress={() => router.push(l.route as any)}>
              <Text style={[styles.link, active === l.key && styles.linkActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.right}>
          {rankName && (
            <TouchableOpacity style={styles.rankBadge} onPress={() => router.push('/ranks')}>
              <Text style={styles.rankLabel}>RANK</Text>
              <Text style={[styles.rankValue, { color: rankColor }]}>{rankName}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', backgroundColor: 'rgba(14,14,14,0.65)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1200, marginHorizontal: 'auto', paddingHorizontal: 20, paddingVertical: 12 },
  logo: { ...RivalType.titleMd, color: RivalColors.accentText, letterSpacing: 4, fontWeight: '800' },
  links: { flexDirection: 'row', gap: 20 },
  link: { ...RivalType.bodyMd, fontSize: 14, color: RivalColors.textSecondary },
  linkActive: { color: RivalColors.textPrimary, fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: { alignItems: 'flex-end' },
  rankLabel: { ...RivalType.labelCaps, fontSize: 9, color: RivalColors.textSecondary },
  rankValue: { fontSize: 14, fontWeight: '700' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: RivalColors.accentFill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarInitial: { color: RivalColors.onAccentFill, fontWeight: '800', fontSize: 15 },
});
