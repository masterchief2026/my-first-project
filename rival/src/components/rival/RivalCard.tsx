import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { RivalColors, RivalRadius, RivalSpacing } from '../../constants/rivalTheme';

// Standard elevated container per DESIGN.md: surface-high, 16px radius, 16px padding.
// `glass` = translucent variant for screens with a photo background (the Stitch
// mockups use rgba(20,20,20,~0.5) cards so the image glows through) — solid
// surfaceHigh stays the default for flat-background screens like Profile.
export function RivalCard({ children, style, glass }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; glass?: boolean }) {
  return <View style={[styles.card, glass && styles.glass, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: RivalColors.surfaceHigh,
    borderRadius: RivalRadius.lg,
    padding: RivalSpacing.stackGap,
  },
  glass: {
    backgroundColor: 'rgba(20, 20, 20, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
});
