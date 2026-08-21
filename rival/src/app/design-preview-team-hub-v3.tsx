// DESIGN PREVIEW ONLY — not linked from any real navigation, reachable by
// typing the URL directly (/design-preview-team-hub-v3). Static port of the
// "Team Hub v3" artifact mockup Ricky reviewed and signed off on (Team
// Challenge hero + top contributors + on-pace inline stat), built around the
// board-reviewed Team Challenge collective-goal mechanic. Mock data only —
// there is no Team Challenge table/query yet, so nothing here is live.
// Delete once real data wiring for Team Challenge is designed and this
// layout is ported into league.tsx for real.
import { Asset } from 'expo-asset';
import { ImageBackground, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { RivalAvatar } from '../components/rival/RivalAvatar';
import { RivalIcon, RivalIconName } from '../components/rival/RivalIcon';
import { RivalColors, RivalType, RivalSerifFamily } from '../constants/rivalTheme';

const HERO_PHOTO = require('../../assets/images/backgrounds/optimized/coastal-highway-triathlete-dusk-3.jpg');

// react-native-web's ImageBackground/Image hardcode `background-position:
// center` on the inner layer that actually paints the photo — the `style`/
// `imageStyle` props never reach that layer, so there is no supported way to
// move the focal point via props (confirmed by reading
// react-native-web/src/exports/Image/index.js: `styles.image` sets
// backgroundPosition directly, disconnected from the style array the props
// feed into). Since this app runs primarily on web (AGENTS.md), render a
// plain View with a raw CSS background-position there instead. Native falls
// back to plain ImageBackground (default centered crop) — customizing the
// focal point on native would need a different approach entirely.
// Matches the artifact's `.hero` background stack exactly: a top-to-bottom
// dark fade + a faint orange glow sit ON TOP of the photo (same background
// shorthand, three comma-separated layers) so the photo visibly darkens
// into the surrounding #131313 well before the hero box ends, instead of
// cutting off hard against a flat scrim.
function HeroPhoto({ style, children }: { style?: any; children?: React.ReactNode }) {
  if (Platform.OS === 'web') {
    const uri = Asset.fromModule(HERO_PHOTO).uri;
    return (
      <View
        style={[
          style,
          {
            backgroundImage: [
              'linear-gradient(180deg, rgba(20,14,10,0.15) 0%, rgba(19,19,19,0.62) 50%, rgba(19,19,19,0.97) 86%)',
              'radial-gradient(120% 70% at 50% 0%, rgba(217,119,87,0.28) 0%, rgba(217,119,87,0) 60%)',
              `url(${uri})`,
            ].join(', '),
            backgroundPosition: '0 0, 0 0, center 45%',
            backgroundSize: 'auto, auto, cover',
            backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
          } as any,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <ImageBackground source={HERO_PHOTO} style={style} resizeMode="cover">
      {children}
    </ImageBackground>
  );
}

const SERIF = RivalSerifFamily;

// The artifact's cards carry a subtle top-left radial highlight over a
// diagonal dark-brown gradient (--card-warm-bg), not a flat fill — same
// react-native-web gradient limitation as HeroPhoto above (no gradient
// story for View backgroundColor), so apply the real CSS on web and fall
// back to the flat approximation (CARD_BG) on native.
const warmCardWeb =
  Platform.OS === 'web'
    ? ({
        backgroundImage:
          'radial-gradient(circle at -10% -15%, rgba(255,209,190,0.14) 0%, rgba(255,209,190,0) 70%), linear-gradient(135deg, #231e1b 0%, #2d241f 55%, #3b2821 100%)',
      } as any)
    : null;
const paceCardWeb =
  Platform.OS === 'web'
    ? ({ backgroundImage: 'linear-gradient(135deg, rgba(217,119,87,0.16), rgba(217,119,87,0.05))' } as any)
    : null;
const chipActiveWeb =
  Platform.OS === 'web'
    ? ({ backgroundImage: `linear-gradient(135deg, ${RivalColors.accentFill}, ${RivalColors.accentText})` } as any)
    : null;
const barFillWeb =
  Platform.OS === 'web'
    ? ({ backgroundImage: `linear-gradient(90deg, ${RivalColors.accentFill}, ${RivalColors.accentText})` } as any)
    : null;
// Matches `.hero::before` — an extra fade concentrated at the very bottom
// edge of the hero, on top of the main gradient above, so the seam into the
// solid body background disappears entirely instead of showing a hard line.
const heroScrimWeb =
  Platform.OS === 'web'
    ? ({ backgroundImage: 'linear-gradient(0deg, rgba(19,19,19,0.95) 0%, transparent 45%)', backgroundColor: 'transparent' } as any)
    : null;

const challenge = {
  title: '1,000 km Run',
  window: 'This month · Aug 1 – Aug 31',
  progress: 423,
  target: 1000,
  pct: 0.423,
  daysLeft: 18,
  teamAvgPerDay: 26.4,
  kmToGo: 577,
  neededPerDay: 32,
};

const contributors = [
  { rank: 1, name: 'Alex M.', km: 82, pct: 1, top: true, me: false },
  { rank: 2, name: 'Sam T.', km: 71, pct: 0.87, top: false, me: false },
  { rank: 3, name: 'You', km: 64, pct: 0.78, top: false, me: true },
  { rank: 4, name: 'Jess D.', km: 52, pct: 0.63, top: false, me: false },
  { rank: 5, name: 'Tom J.', km: 41, pct: 0.5, top: false, me: false },
];

const recentActivity = [
  { name: 'Sarah K.', text: 'added 12 km', time: '2h ago' },
  { name: 'Marcus L.', text: 'added 8 km', time: '4h ago' },
  { name: 'Priya N.', text: 'added 15 km', time: '6h ago' },
];

const filters: { name: RivalIconName; label: string; active?: boolean }[] = [
  { name: 'star', label: 'Overall' },
  { name: 'run', label: 'Run' },
  { name: 'ride', label: 'Ride', active: true },
  { name: 'swim', label: 'Swim' },
  { name: 'weights', label: 'Strength' },
];

// Same SVG-ring technique as design-preview-focus-circular.tsx — a stroked
// circle, transform applied only to the Svg element itself (not a shared
// selector), so it can never leak onto sibling icons the way a broad CSS
// rule did in the original HTML mockup.
function ChallengeRing({ pct, size = 200, thickness = 14 }: { pct: number; size?: number; thickness?: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={RivalColors.accentText} strokeWidth={thickness} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </Svg>
      <RivalIcon name="flag" size={22} color={RivalColors.accentText} style={{ marginBottom: 4 }} />
      <Text style={styles.ringValue}>{challenge.progress}</Text>
      <Text style={styles.ringTarget}>/ {challenge.target.toLocaleString()} km</Text>
    </View>
  );
}

export default function DesignPreviewTeamHubV3() {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <HeroPhoto style={styles.hero}>
            <View style={[styles.heroScrim, heroScrimWeb]} />
            <View style={styles.header}>
              <View>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.teamName}>Trail Blazers</Text>
                  <RivalIcon name="doubleChevronUp" size={16} color="rgba(255,255,255,0.6)" style={{ transform: [{ rotate: '90deg' }] }} />
                </View>
                <Text style={styles.memberCount}>14 members</Text>
              </View>
              <View style={styles.headerActions}>
                <View style={styles.bellBtn}>
                  <RivalIcon name="chat" size={19} color={RivalColors.textPrimary} />
                </View>
                <View style={styles.bellBtn}>
                  <RivalIcon name="notificationsOutline" size={20} color={RivalColors.textPrimary} />
                  <View style={styles.bellDot} />
                </View>
              </View>
            </View>

            <View style={styles.tabs}>
              {['Overview', 'Feed', 'Challenges', 'Members'].map((t, i) => (
                <View key={t} style={[styles.tab, i === 0 && styles.tabActive]}>
                  <Text style={[styles.tabText, i === 0 && styles.tabTextActive]}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.heroTextBlock}>
              <Text style={styles.eyebrow}>Team Challenge</Text>
              <Text style={styles.heroTitle}>{challenge.title}</Text>
              <Text style={styles.heroSub}>{challenge.window}</Text>
            </View>

            <View style={styles.ringWrap}>
              <ChallengeRing pct={challenge.pct} />
            </View>

            <View style={styles.ringMetaRow}>
              <Text style={styles.ringMeta}><Text style={styles.ringMetaBold}>{Math.round(challenge.pct * 100)}%</Text> complete</Text>
              <Text style={styles.ringMeta}><Text style={styles.ringMetaBold}>{challenge.daysLeft}</Text> days left</Text>
            </View>
          </HeroPhoto>

          <View style={styles.body}>
        <View style={[styles.paceCard, paceCardWeb]}>
          <View style={styles.paceIcon}>
            <RivalIcon name="bolt" size={18} color={RivalColors.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.paceTitle}>Keep it up!</Text>
            <Text style={styles.paceSub}>
              Your team needs <Text style={styles.paceSubBold}>{challenge.neededPerDay} km/day</Text> to hit the goal.
            </Text>
          </View>
          <RivalIcon name="trendUp" size={22} color={RivalColors.accentFill} />
        </View>

        <View style={styles.statRow}>
          <View style={[styles.statCard, warmCardWeb]}>
            <RivalIcon name="stats" size={16} color={RivalColors.accentText} style={styles.statIcon} />
            <Text style={styles.statVal}>{challenge.teamAvgPerDay}</Text>
            <Text style={styles.statLbl}>KM/DAY{'\n'}TEAM AVG</Text>
          </View>
          <View style={[styles.statCard, warmCardWeb]}>
            <RivalIcon name="schedule" size={16} color={RivalColors.accentText} style={styles.statIcon} />
            <Text style={styles.statVal}>{challenge.kmToGo}</Text>
            <Text style={styles.statLbl}>KM TO GO</Text>
          </View>
          <View style={[styles.statCard, warmCardWeb]}>
            <RivalIcon name="calendar" size={16} color={RivalColors.accentText} style={styles.statIcon} />
            <Text style={styles.statVal}>{challenge.daysLeft}</Text>
            <Text style={styles.statLbl}>DAYS LEFT</Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          {filters.map((f) => (
            <View key={f.label} style={[styles.chip, f.active ? [styles.chipActive, chipActiveWeb] : warmCardWeb]}>
              <RivalIcon name={f.name} size={17} color={f.active ? '#fff' : 'rgba(255,255,255,0.45)'} />
            </View>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Top Contributors</Text>
          <Text style={styles.sectionLink}>View all</Text>
        </View>
        <View style={[styles.card, warmCardWeb]}>
          {contributors.map((c, i) => (
            <View key={c.name} style={[styles.contribRow, i === contributors.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.rankNum}>{c.rank}</Text>
              <View style={styles.avatarWrap}>
                {c.top ? (
                  <View style={styles.crownWrap}>
                    <RivalIcon name="crown" size={16} color={RivalColors.accentGold} />
                  </View>
                ) : null}
                <RivalAvatar name={c.name} size={34} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.contribName, c.top && styles.gold, c.me && styles.accentText]}>{c.name}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, barFillWeb, { width: `${c.pct * 100}%` }]} />
                </View>
              </View>
              <Text style={[styles.contribKm, c.top && styles.gold, c.me && styles.accentText]}>{c.km} km</Text>
            </View>
          ))}
        </View>

        <View style={styles.paceInline}>
          <Text style={styles.paceInlineArrow}>↑</Text>
          <Text style={styles.paceInlineText}>
            <Text style={styles.paceInlineBold}>8% ahead of pace</Text>
            <Text style={styles.paceInlineSep}> · </Text>
            On track to hit the goal
          </Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>
        <View style={[styles.card, warmCardWeb]}>
          {recentActivity.map((a, i) => (
            <View key={a.name} style={[styles.activityRow, i === recentActivity.length - 1 && { borderBottomWidth: 0 }]}>
              <RivalAvatar name={a.name} size={34} />
              <View>
                <Text style={styles.activityText}><Text style={styles.activityName}>{a.name}</Text> {a.text}</Text>
                <Text style={styles.activityTime}>{a.time}</Text>
              </View>
            </View>
          ))}
        </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CARD_BG = '#2a211d';
const CARD_BORDER = 'rgba(255,181,158,0.14)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RivalColors.surfaceLow },
  safeArea: { flex: 1 },
  hero: { paddingBottom: 24, height: 512, overflow: 'hidden' },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,8,7,0.35)' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamName: { ...RivalType.headlineLgMobile, fontSize: 24, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  memberCount: { fontSize: 13, color: '#d8d4d2', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  headerActions: { flexDirection: 'row', gap: 8 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(20,20,20,0.55)', alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 3.5, backgroundColor: RivalColors.accentFill },

  tabs: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(20,20,20,0.55)', borderRadius: 14, padding: 4, marginHorizontal: 20, marginTop: 14 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(50,50,50,0.9)' },
  tabText: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: '#fff' },

  heroTextBlock: { alignItems: 'center', marginTop: 20, paddingHorizontal: 20 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: RivalColors.accentText, textTransform: 'uppercase' },
  heroTitle: { fontFamily: SERIF, fontStyle: 'italic', fontWeight: '700', fontSize: 24, color: '#fff', marginTop: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  ringWrap: { alignItems: 'center', marginTop: 20 },
  ringValue: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  ringTarget: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  ringMetaRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 20 },
  ringMeta: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  ringMetaBold: { fontWeight: '800', color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },

  paceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(217,119,87,0.1)', borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)',
    borderRadius: 18, padding: 14,
  },
  paceIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(217,119,87,0.22)', alignItems: 'center', justifyContent: 'center' },
  paceTitle: { fontFamily: SERIF, fontStyle: 'italic', fontWeight: '700', fontSize: 15, color: '#fff' },
  paceSub: { fontSize: 12.5, color: RivalColors.onSurfaceVariant, marginTop: 2 },
  paceSubBold: { fontWeight: '800', color: '#fff' },

  statRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
  statIcon: { marginBottom: 8 },
  statVal: { fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  statLbl: { fontFamily: SERIF, fontStyle: 'italic', fontWeight: '700', fontSize: 10, letterSpacing: 0.4, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', textAlign: 'center', marginTop: 4 },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { width: 38, height: 38, borderRadius: 12, backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: RivalColors.accentFill, borderColor: 'transparent' },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: SERIF, fontStyle: 'italic', fontWeight: '700', fontSize: 17, color: '#fff' },
  sectionLink: { fontSize: 12.5, fontWeight: '700', color: RivalColors.accentText, textDecorationLine: 'underline' },

  card: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },

  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rankNum: { width: 16, textAlign: 'center', color: RivalColors.textSecondary, fontSize: 13, fontWeight: '700' },
  avatarWrap: { position: 'relative' },
  crownWrap: { position: 'absolute', top: -12, left: 9, zIndex: 2 },
  contribName: { fontFamily: SERIF, fontStyle: 'italic', fontWeight: '700', fontSize: 14.5, color: '#fff' },
  gold: { color: RivalColors.accentGold },
  accentText: { color: RivalColors.accentText },
  barBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: RivalColors.accentFill },
  contribKm: { color: RivalColors.textSecondary, fontSize: 13, fontWeight: '700' },

  paceInline: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.16)' },
  paceInlineArrow: { color: RivalColors.success, fontWeight: '800', fontSize: 13 },
  paceInlineText: { fontSize: 13, color: RivalColors.textSecondary, lineHeight: 18 },
  paceInlineBold: { color: '#fff', fontWeight: '800' },
  paceInlineSep: { color: 'rgba(255,255,255,0.3)' },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  activityText: { color: '#fff', fontSize: 13 },
  activityName: { fontFamily: SERIF, fontStyle: 'italic', fontWeight: '700' },
  activityTime: { color: RivalColors.textSecondary, fontSize: 11.5, marginTop: 1 },
});
