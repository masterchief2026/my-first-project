// DESIGN PREVIEW ONLY — not linked from any real navigation, reachable by
// typing the URL directly (/design-preview-focus-circular). Shows the real
// FOCUS card (home.tsx, active-goal state) side by side with a variant that
// swaps the linear RivalProgressBar for a circular ring, same content
// otherwise, so the two can be compared before deciding whether to bring the
// circular version into home.tsx for real. Delete once that decision is made.
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { RivalCard, RivalProgressBar } from '../components/rival';
import { RivalColors, RivalRadius, RivalType } from '../constants/rivalTheme';

// Same mock numbers as a real "Run • 100 km" goal card a teammate saw
// mid-session (15.5/100km, 16%, 4 days left) — keeps this preview honest
// instead of inventing new placeholder numbers.
const goal = {
  title: 'Run • 100 km',
  progress: 15.5,
  target: 100,
  unit: 'km',
  pct: 0.155,
  daysLeft: 4,
};

function focusProgressPhrase(pct: number): string {
  if (pct >= 1) return 'YOU EARNED THIS';
  if (pct >= 0.9) return 'So close';
  if (pct >= 0.65) return 'Stay focused';
  if (pct >= 0.5) return "You're over halfway";
  if (pct >= 0.3) return 'Keep showing up';
  return "Let's do this";
}

// Real SVG ring — a stroked circle (Apple Fitness rings, watchOS, etc. all
// use this same technique), not a filled shape with anything faked or
// masked. strokeDasharray = full circumference, strokeDashoffset = how much
// of that circumference to leave unpainted, so the stroke itself only
// covers `pct` of the ring. Two overlaid Circles (track, then progress) —
// no holes, no bleed, no seams, works identically on native.
function CircularProgress({ pct, size = 132, thickness = 5 }: { pct: number; size?: number; thickness?: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={RivalColors.surfaceContainerHigh} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={RivalColors.accentFill} strokeWidth={thickness} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </Svg>
      <Text style={styles.ringValue}>
        {Math.round(goal.progress).toLocaleString()}<Text style={styles.ringValueSub}>{goal.unit}</Text>
      </Text>
    </View>
  );
}

export default function DesignPreviewFocusCircular() {
  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/optimized/a-single-solo-athlete-standing-on.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.scrim} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>Focus card — linear vs. circular</Text>
          <Text style={styles.pageSub}>Same content both sides. Left is the real home.tsx card. Right swaps the bar for a ring.</Text>

          <View style={styles.row}>
            {/* Left: exact copy of home.tsx's active-goal FOCUS card */}
            <RivalCard glass style={styles.card}>
              <View style={{ flex: 1, paddingBottom: 24 }}>
                <View style={styles.topGroup}>
                  <Text style={styles.focusLabel}>FOCUS</Text>
                  <Text style={[styles.focusGoalTitle, styles.titleGap]}>{goal.title}</Text>
                </View>

                <View style={{ flex: 0.8 }} />

                <View style={styles.midGroup}>
                  <Text style={styles.gridCardValue}>
                    {goal.progress.toLocaleString()}
                    <Text style={[styles.gridCardValueSub, { color: RivalColors.textPrimary }]}> / {goal.target.toLocaleString()} {goal.unit}</Text>
                  </Text>
                  <View style={[styles.progressBarWrap, styles.barGap]}>
                    <RivalProgressBar pct={goal.pct} height={10} />
                    <Text style={styles.pctOnBar}>{Math.round(goal.pct * 100)}%</Text>
                  </View>
                  <Text style={[styles.gridCardMeta, styles.metaGap, { color: RivalColors.textPrimary }]} numberOfLines={2}>
                    {focusProgressPhrase(goal.pct)}
                    {'  •  '}
                    <Text style={{ color: RivalColors.accentText }}>
                      {goal.daysLeft === 0 ? 'Last day' : `${goal.daysLeft} day${goal.daysLeft === 1 ? '' : 's'} left`}
                    </Text>
                  </Text>
                </View>

                <View style={{ flex: 1 }} />

                <View style={styles.linkRow}>
                  <Text style={styles.link}>View Focus</Text>
                  <Text style={styles.link}> →</Text>
                </View>
              </View>
            </RivalCard>

            {/* Right: same content, circular ring instead of the linear bar */}
            <RivalCard glass style={styles.card}>
              <View style={{ flex: 1, paddingBottom: 24, alignItems: 'center' }}>
                <View style={[styles.topGroup, { alignItems: 'center' }]}>
                  <Text style={styles.focusLabel}>FOCUS</Text>
                </View>

                <View style={{ flex: 1.8 }} />

                <CircularProgress pct={goal.pct} size={108} />

                <Text style={[styles.focusGoalTitle, { color: RivalColors.textPrimary, marginTop: 4, textAlign: 'center' }]}>{goal.title}</Text>

                <Text style={[styles.gridCardMeta, { color: RivalColors.accentText, marginTop: -2, textAlign: 'center' }]} numberOfLines={2}>
                  {focusProgressPhrase(goal.pct)}
                  {'  •  '}
                  {goal.daysLeft === 0 ? 'Last day' : `${goal.daysLeft} day${goal.daysLeft === 1 ? '' : 's'} left`}
                </Text>

                <View style={{ flex: 1 }} />

                <View style={styles.linkRow}>
                  <Text style={styles.link}>View Focus</Text>
                  <Text style={styles.link}> →</Text>
                </View>
              </View>
            </RivalCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,14,14,0.5)' },
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 20 },
  pageTitle: { ...RivalType.headlineLgMobile, color: RivalColors.textPrimary },
  pageSub: { ...RivalType.bodyMd, fontSize: 13, color: RivalColors.textSecondary, marginTop: -12 },
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  card: { flex: 1, minWidth: 280, minHeight: 320 },

  focusLabel: { ...RivalType.labelCaps, fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)' },
  focusGoalTitle: { ...RivalType.bodyMd, fontSize: 13, color: RivalColors.onSurfaceVariant, marginTop: 2 },
  topGroup: { alignItems: 'center', paddingTop: 4 },
  midGroup: { alignItems: 'center' },
  titleGap: { marginTop: 2 },
  barGap: { marginTop: 4 },
  metaGap: { marginTop: 4 },

  gridCardValue: { fontSize: 38, fontWeight: '300', color: RivalColors.accentText },
  gridCardValueSub: { fontSize: 14, color: RivalColors.textSecondary },
  gridCardMeta: { fontSize: 11, color: RivalColors.textSecondary },
  progressBarWrap: { width: '100%', justifyContent: 'center' },
  pctOnBar: {
    position: 'absolute', alignSelf: 'center', fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  ringValue: { fontSize: 32, fontWeight: '300', color: RivalColors.accentText, textAlign: 'center', width: '100%' },
  ringValueSub: { fontSize: 15, color: RivalColors.textSecondary, marginLeft: 2 },

  linkRow: { flexDirection: 'row', alignSelf: 'center', marginBottom: 10 },
  link: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
});
