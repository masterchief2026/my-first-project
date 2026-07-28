import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getLevel } from '../../lib/xp';
import { getSeasonStartISO } from '../../lib/season';
import { RivalColors, RivalType } from '../../constants/rivalTheme';
import { RivalIcon } from './RivalIcon';

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
  const [displayName, setDisplayName] = useState('');
  const [rankName, setRankName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

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
      setDisplayName(name);
      setInitial(name ? name[0].toUpperCase() : '?');

      const seasonEffort = (seasonActs || []).reduce((s, a) => s + (a.effort_score || 0), 0);
      setRankName(getLevel(seasonEffort).name);
    })();
  }, []);

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => router.push('/home')}>
          <Text style={styles.logo}>RIVAL</Text>
        </TouchableOpacity>

        <View style={[styles.links, Platform.OS === 'web' && (styles.linksCentered as any)]}>
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
              <Text
                style={[
                  styles.rankValue,
                  { color: '#D8A81D', fontStyle: 'italic' },
                  // Same gradient recipe as the hero number on home.tsx —
                  // web-only (background-clip: text has no RN-native
                  // equivalent), flat color above is the native fallback.
                  ...(Platform.OS === 'web' ? [{
                    backgroundImage: 'linear-gradient(180deg, #FFE48A, #D8A81D)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  } as any] : []),
                ]}
              >
                {rankName}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/profile?tab=notifications')} style={styles.notifBtn}>
            <RivalIcon name="notificationsActive" size={22} color={RivalColors.accentText} />
          </TouchableOpacity>
          <View
            style={styles.avatarWrap}
            {...(Platform.OS === 'web'
              ? { onMouseEnter: () => setMenuOpen(true), onMouseLeave: () => setMenuOpen(false) } as any
              : {})}
          >
            <View style={styles.avatarRing}>
              <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{initial}</Text>
                )}
              </TouchableOpacity>
            </View>
            {/* Invisible hover bridge covering the row's own bottom padding
                between the avatar and the bar's bottom edge — without it,
                that strip belongs to `row`/`right` (not a descendant of
                avatarWrap), so crossing it on the way down would fire
                mouseleave and close the menu before the pointer reaches it. */}
            {Platform.OS === 'web' && <View style={styles.avatarMenuBridge} />}
            {Platform.OS === 'web' && (
              <View
                style={[
                  styles.avatarMenu,
                  {
                    transform: [{ scaleY: menuOpen ? 1 : 0 }],
                    opacity: menuOpen ? 1 : 0,
                    transition: 'transform 0.16s ease, opacity 0.12s ease',
                  } as any,
                ]}
                pointerEvents={menuOpen ? 'auto' : 'none'}
              >
                <View style={styles.avatarMenuHeader}>
                  <View style={styles.avatarMenuHeaderAvatar}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarMenuHeaderImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.avatarMenuHeaderName}>{displayName || 'You'}</Text>
                    {rankName && (
                      <Text
                        style={[
                          styles.avatarMenuHeaderRank,
                          { color: '#D8A81D' },
                          // Same gold gradient recipe as the RANK badge above —
                          // web-only, flat gold above is the native fallback.
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
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.avatarMenuItem, hoveredItem === 'profile' && styles.avatarMenuItemHovered]}
                  onPress={() => { setMenuOpen(false); router.push('/profile'); }}
                  {...(Platform.OS === 'web' ? { onMouseEnter: () => setHoveredItem('profile'), onMouseLeave: () => setHoveredItem(null) } as any : {})}
                >
                  <RivalIcon name="person" size={16} color={RivalColors.accentText} />
                  <Text style={styles.avatarMenuText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.avatarMenuItem, hoveredItem === 'friends' && styles.avatarMenuItemHovered]}
                  onPress={() => { setMenuOpen(false); router.push('/friends'); }}
                  {...(Platform.OS === 'web' ? { onMouseEnter: () => setHoveredItem('friends'), onMouseLeave: () => setHoveredItem(null) } as any : {})}
                >
                  <RivalIcon name="groups" size={16} color={RivalColors.accentText} />
                  <Text style={styles.avatarMenuText}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.avatarMenuItem, hoveredItem === 'settings' && styles.avatarMenuItemHovered]}
                  onPress={() => { setMenuOpen(false); router.push('/profile?tab=account'); }}
                  {...(Platform.OS === 'web' ? { onMouseEnter: () => setHoveredItem('settings'), onMouseLeave: () => setHoveredItem(null) } as any : {})}
                >
                  <RivalIcon name="settings" size={16} color={RivalColors.accentText} />
                  <Text style={styles.avatarMenuText}>Settings</Text>
                </TouchableOpacity>
                <View style={styles.avatarMenuDivider} />
                <TouchableOpacity
                  style={[styles.avatarMenuItem, hoveredItem === 'signout' && styles.avatarMenuItemHovered]}
                  onPress={() => { setMenuOpen(false); handleSignOut(); }}
                  {...(Platform.OS === 'web' ? { onMouseEnter: () => setHoveredItem('signout'), onMouseLeave: () => setHoveredItem(null) } as any : {})}
                >
                  <RivalIcon name="logout" size={16} color={RivalColors.accentText} />
                  <Text style={styles.avatarMenuText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', backgroundColor: 'rgba(14,14,14,0.55)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', zIndex: 100 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1200, marginHorizontal: 'auto', paddingHorizontal: 20, paddingVertical: 8, position: 'relative' },
  logo: { ...RivalType.titleMd, color: RivalColors.accentText, letterSpacing: 4, fontWeight: '800' },
  links: { flexDirection: 'row', gap: 32 },
  // The logo (left) and RANK/bell/avatar cluster (right) aren't the same
  // width — RANK badge + notif button + avatar is much wider than "RIVAL" —
  // so `justifyContent: space-between` alone leaves these links biased
  // toward the shorter (left) side instead of sitting at the row's true
  // center. Pin them to the row's actual midpoint instead, independent of
  // sibling widths. Percentage transforms aren't supported on native, so
  // this is web-only; native keeps the old (slightly off-center) flow,
  // which is an acceptable fallback since this app runs primarily on web.
  linksCentered: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
  // Smaller, more letter-spacing, lighter weight — quieter and closer to an
  // Apple-style minimal nav, without going all the way to "near-invisible"
  // (this is core navigation people tap constantly, not a utility bar).
  link: { ...RivalType.bodyMd, fontSize: 13, letterSpacing: 0.6, fontWeight: '400', color: RivalColors.textSecondary },
  linkActive: { color: RivalColors.textPrimary, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: { alignItems: 'flex-end' },
  rankLabel: { ...RivalType.labelCaps, fontSize: 9, color: RivalColors.textSecondary },
  rankValue: { fontSize: 14, fontWeight: '700' },
  notifBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: RivalColors.accentFill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarInitial: { color: RivalColors.onAccentFill, fontWeight: '800', fontSize: 18 },
  // Thin ring as a separate, slightly larger circle rather than a border ON
  // the avatar — a border on the avatar's own fixed-size box would paint
  // over the outer rim of the photo instead of framing it. At 45x45 with a
  // 1.5px border, the inner content box is exactly 42x42, so the avatar
  // photo sits fully inside, untouched.
  avatarRing: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  // Wraps the ring+avatar + its dropdown so the menu can be absolutely
  // positioned relative to just the avatar, not the whole nav row. zIndex
  // so the menu paints above the rank badge / page content instead of
  // behind it.
  avatarWrap: { position: 'relative', zIndex: 100 },
  // top/right land the menu exactly at the bar's own bottom-right corner:
  // 53 = ring height (45) + row's bottom padding (8), and -20 cancels
  // row's horizontal padding — both measured from `row`'s style below.
  // That makes the menu flush with the bar's bottom edge and the screen's
  // right edge instead of just the avatar's edges. Same translucent tone
  // as `bar` (not a near-opaque slab) and no top border, so it genuinely
  // reads as the nav bar's own surface continuing downward — backdropFilter
  // blur keeps text legible over whatever hero photo is behind it, same
  // trick `bar` doesn't need (it sits over a much smaller, more uniform
  // strip of the photo) but this taller panel does. Only the bottom
  // corners are rounded. scaleY + transformOrigin 'top' (set in the inline
  // style above) makes it unfurl from the bar instead of popping in.
  avatarMenu: {
    position: 'absolute', top: 53, right: -20, minWidth: 220,
    backgroundColor: 'rgba(14,14,14,0.55)',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.06)',
    paddingTop: 14, paddingBottom: 8, gap: 4,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      boxShadow: '0 10px 20px rgba(0,0,0,0.35)',
      transformOrigin: 'top',
    } as any : {}),
  },
  // Fills the row's bottom-padding strip (avatar bottom → bar bottom) that
  // avatarMenu's top offset opens up, so hovering down through it stays
  // on an avatarWrap descendant the whole way — see the bridge comment above.
  avatarMenuBridge: { position: 'absolute', top: 45, height: 8, right: -20, width: 220 },
  // Name + rank block at the top of the menu, matching the reference
  // mockup's header row — same avatar image, just bigger, plus rank tier
  // underneath the name so the dropdown reads as "who's signed in", not
  // just a bare list of actions.
  avatarMenuHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  avatarMenuHeaderAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: RivalColors.accentFill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarMenuHeaderImg: { width: 38, height: 38, borderRadius: 19 },
  avatarMenuHeaderName: { ...RivalType.bodyMd, fontSize: 15, fontWeight: '700', color: RivalColors.textPrimary },
  avatarMenuHeaderRank: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.accentText, fontStyle: 'italic', marginTop: 2 },
  avatarMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  // Same "pop" recipe as the home dashboard's gridCardHovered — scale +
  // lifted shadow — plus a background tint since these rows have no card
  // outline of their own to pop against.
  avatarMenuItemHovered: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ scale: 1.03 }],
    ...(Platform.OS === 'web' ? { boxShadow: '0 6px 16px rgba(0,0,0,0.3)' } as any : {}),
  },
  avatarMenuText: { ...RivalType.bodyMd, fontSize: 14, color: RivalColors.textPrimary },
  avatarMenuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 6 },
});
