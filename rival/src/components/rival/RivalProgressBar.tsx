import { StyleSheet, View } from 'react-native';
import { RivalColors, RivalRadius } from '../../constants/rivalTheme';

// Shared progress bar for Goals/Streaks/Levels — terracotta fill on a charcoal
// track, with optional milestone ticks (e.g. 25/50/75% checkpoints on Goals).
export function RivalProgressBar({
  pct,
  milestones,
  height = 8,
}: {
  pct: number; // 0-1
  milestones?: number[]; // e.g. [0.25, 0.5, 0.75]
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, height }]} />
      {(milestones ?? []).map((m) => (
        <View key={m} style={[styles.tick, { left: `${m * 100}%` }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: RivalRadius.full,
    backgroundColor: RivalColors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: RivalRadius.full,
    backgroundColor: RivalColors.accentFill,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: RivalColors.surfaceLow,
    opacity: 0.6,
  },
});
