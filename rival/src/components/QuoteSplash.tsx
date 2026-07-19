import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, ImageBackground } from 'react-native';
import { Quote } from '../lib/quotes';
import { getDailyBackground } from '../lib/dailyBackground';
import { RivalColors, RivalRadius, RivalType } from '../constants/rivalTheme';

const STORAGE_KEY = 'rival_quote_date';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function hasSeenToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayStr();
  } catch {
    return false;
  }
}

function markSeenToday() {
  try {
    localStorage.setItem(STORAGE_KEY, todayStr());
  } catch {}
}

const CATEGORY_LABELS: Record<string, string> = {
  levelup:     'LEVEL UP',
  unrivaled:   'UNRIVALED',
  progress:    'PROGRESS',
  longterm:    'LONG GAME',
  consistency: 'CONSISTENCY',
  identity:    'IDENTITY',
  recovery:    'RECOVERY',
  nutrition:   'FUEL',
  community:   'COMMUNITY',
  competition: 'COMPETITION',
  wisdom:      'WISDOM',
};

type Props = {
  quote: Quote;
  onDismiss: () => void;
};

export default function QuoteSplash({ quote, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const opacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (hasSeenToday()) {
      onDismiss();
      return;
    }
    setVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  function dismiss() {
    markSeenToday();
    Animated.timing(opacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss();
    });
  }

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <ImageBackground source={getDailyBackground()} style={styles.bg} resizeMode="cover">
        {/* Scrim for text legibility — the daily photo pool rotates through
            varied brightness/sun placement, so a flat dark gradient underneath
            all the text (not just behind the quote block) keeps every photo readable. */}
        <View style={styles.scrim} />
        <TouchableOpacity style={styles.inner} onPress={dismiss} activeOpacity={1}>

          <Text style={styles.logo}>RIVAL</Text>

          <View style={styles.quoteBlock}>
            {quote.category && (
              <Text style={styles.category}>{CATEGORY_LABELS[quote.category] ?? ''}</Text>
            )}
            <Text style={styles.quoteText}>{quote.text}</Text>
            {quote.author && (
              <Text style={styles.author}>— {quote.author}</Text>
            )}
          </View>

          <TouchableOpacity style={styles.goButton} onPress={dismiss}>
            <Text style={styles.goButtonText}>Let's go →</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 'fixed' (not 'absolute') so the splash covers the true viewport regardless
  // of the page behind it scrolling taller than one screen — 'absolute' anchors
  // to the viewport-sized initial containing block only for the first screenful,
  // leaving the rest of a tall page uncovered (same fix as bgFixed in
  // home.tsx/league.tsx/lifts.tsx/my-activities.tsx).
  overlay: {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%', height: '100%',
    backgroundColor: RivalColors.surfaceLowest,
    zIndex: 999,
  },
  bg: {
    // Explicit width/height (not just flex:1) — without it, react-native-web
    // falls back to the source image's native pixel dimensions instead of
    // stretching to the container (same reason bgFixed elsewhere sets these).
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(14,14,14,0.55)',
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 80,
    paddingBottom: 60,
  },
  logo: {
    ...RivalType.titleMd,
    color: RivalColors.textPrimary,
    letterSpacing: 6,
  },
  quoteBlock: {
    alignItems: 'center',
    gap: 20,
  },
  category: {
    ...RivalType.labelCaps,
    color: RivalColors.accentText,
    letterSpacing: 3,
  },
  quoteText: {
    // Serif, not the app's usual sans — a quote meant to be sat with reads as
    // wisdom in a way bold sans-serif italic doesn't.
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '400',
    color: RivalColors.textPrimary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  author: {
    ...RivalType.bodyMd,
    fontSize: 14,
    color: RivalColors.onSurfaceVariant,
  },
  goButton: {
    backgroundColor: RivalColors.accentFill,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: RivalRadius.full,
  },
  goButtonText: {
    color: RivalColors.onAccentFill,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
