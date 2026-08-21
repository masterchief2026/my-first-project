import { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RivalColors, RivalType, RivalRadius, RivalFontFamily, RivalSerifFamily } from '../constants/rivalTheme';

// Standalone preview for one open question: should Today's display NUMBERS use
// the editorial serif the app already speaks on Team Feed / Team Hub, instead of
// Manrope? Same pattern as design-preview-focus-circular — a throwaway route to
// look at, not wired into navigation.
//
// The comparison is deliberately narrow. Every variant below changes ONLY the
// big number and the card title; kickers, units, progress bars and body text
// stay Manrope in all four. That is the actual proposal — a display face used
// selectively — not "make Today serif", which is what the accidental fallback
// did and why it looked wrong on buttons and labels.

const WEBFONTS =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&display=swap';

type Variant = { key: string; label: string; note: string; family: string; italic: boolean; weight: any; cost: string };

const VARIANTS: Variant[] = [
  {
    key: 'manrope', label: 'Manrope 800', note: 'What ships today. Neutral, modern, reads as "app UI".',
    family: RivalFontFamily, italic: false, weight: '800', cost: 'already loaded',
  },
  {
    key: 'georgia', label: 'Georgia Italic', note: "The app's existing accent face — already used on Team Feed and Team Hub. Consistent by definition.",
    family: RivalSerifFamily, italic: true, weight: '700', cost: 'free — system font, 0 KB',
  },
  {
    key: 'instrument', label: 'Instrument Serif', note: 'High contrast, editorial, a touch of gravity. Closest to "trophy".',
    family: '"Instrument Serif", Georgia, serif', italic: false, weight: '400', cost: '~28 KB webfont',
  },
  {
    key: 'fraunces', label: 'Fraunces', note: 'Softer, warmer, more characterful. Least like a spreadsheet.',
    family: '"Fraunces", Georgia, serif', italic: false, weight: '700', cost: '~46 KB webfont',
  },
];

function FocusCard({ v }: { v: Variant }) {
  const display = {
    fontFamily: v.family,
    fontWeight: v.weight,
    ...(v.italic ? { fontStyle: 'italic' as const } : {}),
  };
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>FOCUS</Text>
      <Text style={[styles.title, display]}>Swim</Text>
      <View style={styles.heroRow}>
        <Text style={[styles.heroNumber, display]}>4.9</Text>
        <Text style={styles.heroUnit}>/ 10 km</Text>
      </View>
      <View style={styles.bar}>
        <View style={styles.barFill} />
        <Text style={styles.barPct}>49%</Text>
      </View>
      <Text style={styles.days}>11 Days Remaining</Text>

      <View style={styles.divider} />

      {/* The other place big numbers live on Today */}
      <Text style={styles.kicker}>LEGACY</Text>
      <Text style={[styles.legacyNumber, display]}>13,462</Text>
      <Text style={styles.legacyLabel}>TOTAL EFFORT</Text>
    </View>
  );
}

export default function TodayTypePreview() {
  // Load the two candidate webfonts for this preview only, rather than putting
  // them in global.css where every screen would pay for them before a decision
  // has been made.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.getElementById('type-preview-fonts')) return;
    const l = document.createElement('link');
    l.id = 'type-preview-fonts';
    l.rel = 'stylesheet';
    l.href = WEBFONTS;
    document.head.appendChild(l);
  }, []);

  return (
    <View style={styles.page}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.h1}>Today · display type</Text>
          <Text style={styles.sub}>
            Only the big number and the card title change. Everything else stays Manrope.
          </Text>

          {VARIANTS.map((v) => (
            <View key={v.key} style={styles.block}>
              <View style={styles.headerRow}>
                <Text style={styles.variantLabel}>{v.label}</Text>
                <Text style={styles.cost}>{v.cost}</Text>
              </View>
              <Text style={styles.note}>{v.note}</Text>
              <FocusCard v={v} />
            </View>
          ))}

          <Text style={styles.footer}>
            Scroll back and forth between the four — the differences read more clearly in
            motion than side by side.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#131313' },
  content: { padding: 20, paddingBottom: 80, gap: 8, maxWidth: 640, width: '100%', alignSelf: 'center' },
  h1: { ...RivalType.headlineLgMobile, color: RivalColors.textPrimary },
  sub: { ...RivalType.bodyMd, fontSize: 14, color: RivalColors.textSecondary, marginBottom: 18 },

  block: { marginBottom: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  variantLabel: { ...RivalType.labelCaps, fontSize: 12, color: RivalColors.accentText },
  cost: { ...RivalType.bodyMd, fontSize: 11, color: RivalColors.textSecondary },
  note: { ...RivalType.bodyMd, fontSize: 13, color: RivalColors.textSecondary, marginBottom: 10, lineHeight: 19 },

  card: {
    backgroundColor: 'rgba(28,28,28,0.9)', borderRadius: RivalRadius.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center',
  },
  kicker: { ...RivalType.labelCaps, fontSize: 11, color: RivalColors.accentText, letterSpacing: 1.6 },
  title: { fontSize: 22, color: RivalColors.textPrimary, marginTop: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 16 },
  heroNumber: {
    fontSize: 46, letterSpacing: -0.4, color: RivalColors.accentFill,
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #D97757 150%)',
      backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent',
    } as any : {}),
  },
  heroUnit: { ...RivalType.bodyMd, fontSize: 17, color: RivalColors.textSecondary },
  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', width: '100%', marginTop: 14, justifyContent: 'center' },
  barFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: '49%', borderRadius: 4,
    ...(Platform.OS === 'web' ? { backgroundImage: 'linear-gradient(90deg, #D97757, #F5B759)' } as any : { backgroundColor: '#D97757' }),
  },
  barPct: { position: 'absolute', right: '48%', fontSize: 10, fontWeight: '700', color: '#fff' },
  days: { ...RivalType.bodyMd, fontSize: 14, color: RivalColors.accentText, marginTop: 12 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'stretch', marginVertical: 22 },
  legacyNumber: {
    fontSize: 42, marginTop: 8, color: RivalColors.textPrimary,
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #E8B9A6 140%)',
      backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent',
    } as any : {}),
  },
  legacyLabel: { ...RivalType.labelCaps, fontSize: 10, color: RivalColors.accentText, letterSpacing: 1.4, marginTop: 4 },

  footer: { ...RivalType.bodyMd, fontSize: 12, color: RivalColors.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 18 },
});
