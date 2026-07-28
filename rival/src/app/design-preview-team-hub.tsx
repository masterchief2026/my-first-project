// DESIGN PREVIEW ONLY — not linked from any real navigation, reachable by typing
// the URL directly. Static/placeholder content matching the locked Stitch Team
// Hub mockup (rival/design/stitch-export-4/) exactly, so the LAYOUT can be
// reviewed before real data gets wired into each slot. Two structural questions
// this preview deliberately leaves open (Ricky's call, not guessed at):
//   1. Does "Team Distance Goal" replace/relate to the existing Goals feature,
//      or is it a new team-level goal concept?
//   2. Sidebar nav here (Team Feed / My Training / Club Members / My Impact)
//      replaces the real app's tab bar (Feed/Chat/Sessions/Challenges) — is
//      that swap intended, or do tabs still live somewhere in this layout?
// Delete once Team Hub's real rebuild is signed off and matches this.
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RivalCard, RivalProgressBar } from '../components/rival';
import { RivalColors, RivalRadius, RivalType } from '../constants/rivalTheme';

export default function DesignPreviewTeamHub() {
  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/optimized/ridge-runners-hazy-backlit.jpg')}
      style={styles.bg}
      imageStyle={{ objectPosition: '55% 65%' } as any}
      resizeMode="cover"
    >
      <View style={styles.scrim} />
      <SafeAreaView style={styles.container}>
        <View style={styles.layout}>

          {/* Sidebar nav */}
          <View style={styles.sidebar}>
            <View style={styles.sidebarTeamRow}>
              <View style={styles.sidebarTeamIcon}><Text>👥</Text></View>
              <View>
                <Text style={styles.sidebarTeamName}>[Team name]</Text>
                <Text style={styles.sidebarTeamSub}>Team Hub</Text>
              </View>
            </View>

            <View style={styles.sidebarNav}>
              <View style={[styles.sidebarNavItem, styles.sidebarNavItemActive]}>
                <Text style={styles.sidebarNavIcon}>📡</Text>
                <Text style={styles.sidebarNavTextActive}>Team Feed</Text>
              </View>
              <View style={styles.sidebarNavItem}>
                <Text style={styles.sidebarNavIcon}>📊</Text>
                <Text style={styles.sidebarNavText}>My Training</Text>
              </View>
              <View style={styles.sidebarNavItem}>
                <Text style={styles.sidebarNavIcon}>👤</Text>
                <Text style={styles.sidebarNavText}>[Club Members? — placeholder label]</Text>
              </View>
              <View style={styles.sidebarNavItem}>
                <Text style={styles.sidebarNavIcon}>📈</Text>
                <Text style={styles.sidebarNavText}>[My Impact? — placeholder label]</Text>
              </View>
            </View>

            <View style={styles.sidebarBottom}>
              <TouchableOpacity style={styles.addWorkoutBtn}>
                <Text style={styles.addWorkoutBtnText}>+ Add Workout</Text>
              </TouchableOpacity>
              <Text style={styles.sidebarFooterLink}>⚙️ Settings</Text>
              <Text style={styles.sidebarFooterLink}>❓ Support</Text>
            </View>
          </View>

          {/* Main column */}
          <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
            <View style={styles.mainHeader}>
              <View>
                <Text style={styles.mainTitle}>Team Feed</Text>
                <Text style={styles.mainSub}>[Team name] · [XX] Active Members</Text>
              </View>
              <View style={styles.avatarStack}>
                <View style={styles.stackAvatar} />
                <View style={styles.stackAvatar} />
                <View style={styles.stackAvatar} />
                <View style={[styles.stackAvatar, styles.stackAvatarMore]}><Text style={styles.stackAvatarMoreText}>+[X]</Text></View>
              </View>
            </View>

            {/* Feed card */}
            <RivalCard style={styles.feedCard}>
              <View style={styles.feedCardHeader}>
                <View style={styles.feedUserRow}>
                  <View style={styles.feedAvatar} />
                  <View>
                    <Text style={styles.feedUserName}>[Athlete name]</Text>
                    <Text style={styles.feedActivityMeta}>[Activity type] · [XX.X km]</Text>
                  </View>
                </View>
                <View style={styles.feedScoreBlock}>
                  <Text style={styles.feedScore}>[000]</Text>
                  <Text style={styles.feedScoreLabel}>EFFORT</Text>
                </View>
              </View>

              <View style={styles.feedPhoto}>
                <Text style={styles.feedPhotoPlaceholder}>[Activity photo]</Text>
                <View style={styles.feedPhotoStatsRow}>
                  <View style={styles.feedPhotoStat}><Text style={styles.feedPhotoStatText}>⏱ [0:00/km]</Text></View>
                  <View style={styles.feedPhotoStat}><Text style={styles.feedPhotoStatText}>⏲ [00:00]</Text></View>
                </View>
              </View>

              <View style={styles.reactionRow}>
                <TouchableOpacity style={[styles.reactionChip, styles.reactionChipActive]}>
                  <Text style={styles.reactionChipTextActive}>♡ Respect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reactionChip}>
                  <Text style={styles.reactionChipText}>⚡ Inspired</Text>
                </TouchableOpacity>
                <Text style={styles.commentCount}>💬 [XX]</Text>
              </View>
            </RivalCard>

            {/* Second feed item (no photo state) */}
            <RivalCard style={styles.feedCard}>
              <View style={styles.feedCardHeader}>
                <View style={styles.feedUserRow}>
                  <View style={styles.feedAvatar} />
                  <View>
                    <Text style={styles.feedUserName}>[Athlete name]</Text>
                    <Text style={styles.feedActivityMeta}>[Activity type] · [Location]</Text>
                  </View>
                </View>
                <View style={styles.feedScoreBlock}>
                  <Text style={styles.feedScore}>[000]</Text>
                  <Text style={styles.feedScoreLabel}>EFFORT</Text>
                </View>
              </View>
              <Text style={styles.noPhotoNote}>[No-photo state — needs its own design, see review notes]</Text>
            </RivalCard>
          </ScrollView>

          {/* Right sidebar */}
          <View style={styles.rightSidebar}>
            <RivalCard style={styles.sideCard}>
              <View style={styles.sideCardHeader}>
                <Text style={styles.sideCardLabel}>[TEAM DISTANCE GOAL? — placeholder, concept TBD]</Text>
                <Text style={styles.flagIcon}>🚩</Text>
              </View>
              <View style={styles.sideCardValueRow}>
                <Text style={styles.sideCardValue}>[000]</Text>
                <Text style={styles.sideCardValueUnit}>km</Text>
                <Text style={styles.sideCardValueTarget}>Target: [000]km</Text>
              </View>
              <RivalProgressBar pct={0.64} />
              <Text style={styles.sideCardMeta}>[64% of monthly goal reached]</Text>
            </RivalCard>

            <RivalCard style={styles.sideCard}>
              <View style={styles.sideCardHeader}>
                <Text style={styles.sideCardLabel}>TEAM STANDINGS</Text>
                <Text style={styles.flagIcon}>📊</Text>
              </View>
              {[1, 2, 3].map((rank) => (
                <View key={rank} style={styles.standingRow}>
                  <Text style={styles.standingRank}>{rank}</Text>
                  <View style={styles.standingAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.standingName}>[Member name]</Text>
                    <Text style={styles.standingScore}>[000] Effort</Text>
                  </View>
                  <Text style={styles.standingTrend}>{rank === 1 ? '↗' : rank === 2 ? '—' : '↘'}</Text>
                </View>
              ))}
            </RivalCard>
          </View>

        </View>

        <TouchableOpacity style={styles.chatFab}>
          <Text style={styles.chatFabIcon}>💬</Text>
          <Text style={styles.chatFabText}>Team Chat</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,14,14,0.55)' },
  container: { flex: 1 },
  layout: { flex: 1, flexDirection: 'row', padding: 20, gap: 16 },

  sidebar: { width: 220, gap: 24, justifyContent: 'space-between' },
  sidebarTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sidebarTeamIcon: { width: 40, height: 40, borderRadius: RivalRadius.md, backgroundColor: 'rgba(40,40,40,0.7)', alignItems: 'center', justifyContent: 'center' },
  sidebarTeamName: { fontSize: 14, fontWeight: '700', color: RivalColors.accentText },
  sidebarTeamSub: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.textSecondary },
  sidebarNav: { gap: 4 },
  sidebarNavItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: RivalRadius.DEFAULT },
  sidebarNavItemActive: { backgroundColor: `${RivalColors.accentFill}22` },
  sidebarNavIcon: { fontSize: 16, width: 20 },
  sidebarNavText: { fontSize: 13, color: RivalColors.textSecondary },
  sidebarNavTextActive: { fontSize: 13, color: RivalColors.accentText, fontWeight: '700' },
  sidebarBottom: { gap: 12 },
  addWorkoutBtn: { backgroundColor: RivalColors.accentFill, borderRadius: RivalRadius.DEFAULT, paddingVertical: 12, alignItems: 'center' },
  addWorkoutBtnText: { color: RivalColors.onAccentFill, fontWeight: '700', fontSize: 13 },
  sidebarFooterLink: { fontSize: 12, color: RivalColors.textSecondary },

  main: { flex: 2 },
  mainContent: { gap: 16, paddingBottom: 40 },
  mainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mainTitle: { ...RivalType.headlineLgMobile, color: RivalColors.textPrimary },
  mainSub: { fontSize: 13, color: RivalColors.textSecondary, marginTop: 2 },
  avatarStack: { flexDirection: 'row' },
  stackAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: RivalColors.surfaceContainerHigh, borderWidth: 2, borderColor: RivalColors.surfaceHigh, marginLeft: -8 },
  stackAvatarMore: { alignItems: 'center', justifyContent: 'center' },
  stackAvatarMoreText: { fontSize: 9, color: RivalColors.textSecondary, fontWeight: '700' },

  feedCard: { gap: 12 },
  feedCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feedUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: RivalColors.surfaceContainerHigh },
  feedUserName: { fontSize: 14, fontWeight: '700', color: RivalColors.textPrimary },
  feedActivityMeta: { fontSize: 12, color: RivalColors.textSecondary },
  feedScoreBlock: { alignItems: 'flex-end' },
  feedScore: { fontSize: 20, fontWeight: '700', color: RivalColors.accentText },
  feedScoreLabel: { ...RivalType.labelCaps, fontSize: 9, color: RivalColors.textSecondary },

  feedPhoto: { height: 220, borderRadius: RivalRadius.DEFAULT, backgroundColor: RivalColors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  feedPhotoPlaceholder: { color: RivalColors.textSecondary, fontSize: 13 },
  feedPhotoStatsRow: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', gap: 8 },
  feedPhotoStat: { backgroundColor: 'rgba(14,14,14,0.6)', borderRadius: RivalRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  feedPhotoStatText: { fontSize: 11, color: RivalColors.textPrimary },

  reactionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reactionChip: { backgroundColor: RivalColors.surfaceLowest, borderRadius: RivalRadius.full, paddingVertical: 6, paddingHorizontal: 12 },
  reactionChipActive: { backgroundColor: RivalColors.accentFill },
  reactionChipText: { fontSize: 12, color: RivalColors.onSurface },
  reactionChipTextActive: { fontSize: 12, color: RivalColors.onAccentFill, fontWeight: '700' },
  commentCount: { fontSize: 12, color: RivalColors.textSecondary, marginLeft: 'auto' },
  noPhotoNote: { fontSize: 12, color: RivalColors.textSecondary, fontStyle: 'italic', paddingVertical: 12 },

  rightSidebar: { width: 260, gap: 16 },
  sideCard: { gap: 10 },
  sideCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideCardLabel: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.textSecondary, flex: 1 },
  flagIcon: { fontSize: 14 },
  sideCardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  sideCardValue: { fontSize: 28, fontWeight: '300', color: RivalColors.textPrimary },
  sideCardValueUnit: { fontSize: 14, color: RivalColors.textSecondary },
  sideCardValueTarget: { fontSize: 11, color: RivalColors.textSecondary, marginLeft: 'auto' },
  sideCardMeta: { fontSize: 10, color: RivalColors.textSecondary },

  standingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  standingRank: { width: 16, fontSize: 13, fontWeight: '700', color: RivalColors.textSecondary },
  standingAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: RivalColors.surfaceContainerHigh },
  standingName: { fontSize: 13, fontWeight: '700', color: RivalColors.textPrimary },
  standingScore: { fontSize: 11, color: RivalColors.textSecondary },
  standingTrend: { fontSize: 14, color: RivalColors.success },

  chatFab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: 'rgba(24,24,24,0.85)', borderRadius: RivalRadius.full, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatFabIcon: { fontSize: 16 },
  chatFabText: { color: RivalColors.textPrimary, fontWeight: '700', fontSize: 13 },
});
