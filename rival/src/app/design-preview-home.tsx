// DESIGN PREVIEW ONLY — not linked from any real navigation, reachable by typing
// the URL directly. Static/placeholder content matching the locked Stitch
// dashboard mockup exactly, so the CARD LAYOUT can be reviewed and decided on
// before real data gets wired into each slot. Delete once Home's real rebuild
// is signed off and matches this.
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RivalCard, RivalProgressBar } from '../components/rival';
import { RivalColors, RivalRadius, RivalSpacing, RivalType } from '../constants/rivalTheme';

export default function DesignPreviewHome() {
  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/optimized/a-single-solo-athlete-standing-on.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.scrim} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>

          {/* Top nav */}
          <View style={styles.navRow}>
            <Text style={styles.logo}>RIVAL</Text>
            <View style={styles.navLinks}>
              <Text style={[styles.navLink, styles.navLinkActive]}>Teams</Text>
              <Text style={styles.navLink}>My Training</Text>
              <Text style={styles.navLink}>Profile</Text>
            </View>
            <View style={styles.navRight}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeLabel}>RANK</Text>
                <Text style={styles.rankBadgeValue}>Unrivaled</Text>
              </View>
              <Text style={styles.bellIcon}>🔔</Text>
              <View style={styles.avatarCircle} />
            </View>
          </View>

          {/* Greeting */}
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>Hey, [Name]</Text>
            <Text style={styles.greetingSub}>[Daily quote line — PLACEHOLDER]</Text>
          </View>

          {/* Hero: Total Time Earned */}
          <RivalCard style={styles.heroCard}>
            <Text style={styles.heroIcon}>⏱</Text>
            <Text style={styles.heroLabel}>TOTAL TIME EARNED</Text>
            <Text style={styles.heroValue}>[000h 00m]</Text>
            <Text style={styles.heroSub}>[Trained · PLACEHOLDER SUBLINE]</Text>
          </RivalCard>

          {/* 4-card row */}
          <View style={styles.cardRow}>
            <RivalCard style={styles.gridCard}>
              <View style={styles.cardTagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>ACTIVE MISSION</Text></View>
                <Text style={styles.flagIcon}>🚩</Text>
              </View>
              <Text style={styles.gridCardLabel}>DISTANCE GOAL</Text>
              <Text style={styles.gridCardValue}>[000] <Text style={styles.gridCardValueSub}>/ [000] km</Text></Text>
              <RivalProgressBar pct={0.24} />
              <Text style={styles.gridCardMeta}>[X days remaining]</Text>
              <TouchableOpacity style={styles.gridCardBtn}><Text style={styles.gridCardBtnText}>Resume Mission</Text></TouchableOpacity>
            </RivalCard>

            <RivalCard style={styles.gridCard}>
              <View style={styles.streakCircle} />
              <Text style={styles.gridCardLabel}>CURRENT STREAK</Text>
              <Text style={styles.streakValue}>[00] <Text style={styles.gridCardValueSub}>WEEKS</Text></Text>
              <Text style={styles.gridCardMeta}>Longest streak: [00] weeks</Text>
            </RivalCard>

            <RivalCard style={styles.gridCard}>
              <View style={styles.cardTagRow}>
                <View style={styles.avatarSmallCircle} />
                <View>
                  <Text style={styles.gridCardTitle}>Momentum</Text>
                  <Text style={styles.gridCardLabel}>ACTIVE NOW</Text>
                </View>
              </View>
              <View style={styles.momentumRow}>
                <View style={styles.momentumAvatar}><Text style={styles.momentumAvatarText}>[XX]</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.momentumName}>[Team name]</Text>
                  <Text style={styles.momentumMeta}>[X active]</Text>
                </View>
              </View>
              <View style={styles.momentumRow}>
                <View style={styles.momentumAvatar}><Text style={styles.momentumAvatarText}>[XX]</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.momentumName}>[Team name]</Text>
                  <Text style={styles.momentumMeta}>[X trained]</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.gridCardBtn}><Text style={styles.gridCardBtnText}>Join Training →</Text></TouchableOpacity>
            </RivalCard>

            <RivalCard style={styles.gridCard}>
              <Text style={styles.gridCardTitle}>STATS SNAPSHOT</Text>
              <View style={styles.snapshotRow}>
                <Text style={styles.snapshotIcon}>📍</Text>
                <View><Text style={styles.gridCardLabel}>DISTANCE (KM)</Text><Text style={styles.snapshotValue}>[0,000]</Text></View>
              </View>
              <View style={styles.snapshotRow}>
                <Text style={styles.snapshotIcon}>⛰️</Text>
                <View><Text style={styles.gridCardLabel}>CLIMBED (M)</Text><Text style={styles.snapshotValue}>[0,000]</Text></View>
              </View>
              <View style={styles.snapshotRow}>
                <Text style={styles.snapshotIcon}>🏁</Text>
                <View><Text style={styles.gridCardLabel}>NEXT RACE</Text><Text style={styles.snapshotValue}>[00 Days]</Text></View>
              </View>
              <View style={styles.snapshotDivider} />
              <TouchableOpacity style={styles.aiShareRow}>
                <Text style={styles.snapshotIcon}>✨</Text>
                <View><Text style={styles.gridCardLabel}>AI SHARE</Text><Text style={styles.snapshotValue}>Generate Story</Text></View>
              </TouchableOpacity>
            </RivalCard>
          </View>

          {/* Season Wrap strip */}
          <RivalCard style={styles.seasonWrap}>
            <View style={styles.seasonWrapHeader}>
              <View>
                <Text style={styles.seasonWrapTitle}>SEASON WRAP</Text>
                <Text style={styles.seasonWrapSub}>Your momentum at a glance</Text>
              </View>
              <Text style={styles.seasonWrapLink}>TRAINING HISTORY →</Text>
            </View>
            <View style={styles.seasonWrapRow}>
              <View><Text style={styles.gridCardLabel}>EFFORT</Text><Text style={styles.seasonWrapValue}>[00.0k]</Text></View>
              <View><Text style={styles.gridCardLabel}>ACTIVITIES</Text><Text style={styles.seasonWrapValue}>[000]</Text></View>
              <View><Text style={styles.gridCardLabel}>[??? — no real metric]</Text><Text style={styles.seasonWrapValue}>[???]</Text></View>
              <View><Text style={styles.gridCardLabel}>RIVAL RANK</Text><Text style={styles.seasonWrapRank}>[RANK]</Text></View>
            </View>
          </RivalCard>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,14,14,0.5)' },
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48, gap: 20 },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { ...RivalType.titleMd, color: RivalColors.accentText, letterSpacing: 4 },
  navLinks: { flexDirection: 'row', gap: 20 },
  navLink: { ...RivalType.bodyMd, fontSize: 14, color: RivalColors.textSecondary },
  navLinkActive: { color: RivalColors.textPrimary, fontWeight: '700' },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rankBadge: { alignItems: 'flex-end' },
  rankBadgeLabel: { ...RivalType.labelCaps, fontSize: 9, color: RivalColors.textSecondary },
  rankBadgeValue: { fontSize: 13, fontWeight: '700', color: RivalColors.rankAnchors.unrivaled },
  bellIcon: { fontSize: 18 },
  avatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: RivalColors.surfaceContainerHigh, borderWidth: 1, borderColor: RivalColors.accentFill },

  greetingBlock: { alignItems: 'center', gap: 6, marginTop: 12 },
  greeting: { ...RivalType.headlineLg, color: RivalColors.textPrimary },
  greetingSub: { ...RivalType.bodyMd, color: RivalColors.onSurfaceVariant, textAlign: 'center' },

  heroCard: { alignItems: 'center', gap: 6 },
  heroIcon: { fontSize: 22, marginBottom: 4 },
  heroLabel: { ...RivalType.labelCaps, color: RivalColors.textSecondary },
  heroValue: { ...RivalType.displayHero, color: RivalColors.accentText },
  heroSub: { ...RivalType.bodyMd, fontSize: 13, color: RivalColors.textSecondary },

  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { flex: 1, minWidth: 220, gap: 8 },
  cardTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tag: { backgroundColor: `${RivalColors.accentFill}22`, borderRadius: RivalRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.accentText },
  flagIcon: { fontSize: 14 },
  gridCardLabel: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.textSecondary },
  gridCardTitle: { fontSize: 15, fontWeight: '700', color: RivalColors.textPrimary },
  gridCardValue: { fontSize: 26, fontWeight: '300', color: RivalColors.accentText },
  gridCardValueSub: { fontSize: 14, color: RivalColors.textSecondary },
  gridCardMeta: { fontSize: 11, color: RivalColors.textSecondary },
  gridCardBtn: { backgroundColor: RivalColors.accentFill, borderRadius: RivalRadius.full, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  gridCardBtnText: { color: RivalColors.onAccentFill, fontWeight: '700', fontSize: 13 },

  streakCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: RivalColors.surfaceContainerHigh, alignSelf: 'center' },
  streakValue: { fontSize: 26, fontWeight: '300', color: RivalColors.textPrimary, textAlign: 'center' },

  avatarSmallCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: RivalColors.surfaceContainerHigh },
  momentumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  momentumAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: RivalColors.tertiaryContainer, alignItems: 'center', justifyContent: 'center' },
  momentumAvatarText: { fontSize: 9, color: RivalColors.textPrimary, fontWeight: '700' },
  momentumName: { fontSize: 13, fontWeight: '600', color: RivalColors.textPrimary },
  momentumMeta: { fontSize: 11, color: RivalColors.accentText },

  snapshotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  snapshotIcon: { fontSize: 16 },
  snapshotValue: { fontSize: 16, fontWeight: '700', color: RivalColors.textPrimary },
  snapshotDivider: { height: 1, backgroundColor: RivalColors.surfaceContainerHigh, marginVertical: 4 },
  aiShareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  seasonWrap: { gap: 14 },
  seasonWrapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  seasonWrapTitle: { ...RivalType.labelCaps, color: RivalColors.accentText },
  seasonWrapSub: { fontSize: 13, color: RivalColors.textSecondary, marginTop: 2 },
  seasonWrapLink: { ...RivalType.labelCaps, fontSize: 11, color: RivalColors.textSecondary },
  seasonWrapRow: { flexDirection: 'row', justifyContent: 'space-between' },
  seasonWrapValue: { fontSize: 20, fontWeight: '600', color: RivalColors.textPrimary, marginTop: 4 },
  seasonWrapRank: { fontSize: 20, fontWeight: '800', color: RivalColors.rankAnchors.unrivaled, fontStyle: 'italic', marginTop: 4 },
});
