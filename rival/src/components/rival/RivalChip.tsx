import { StyleSheet, Text, View } from 'react-native';
import { RivalColors, RivalRadius, RivalType } from '../../constants/rivalTheme';

// Small pill for rank badges, status labels, filter chips.
export function RivalChip({ label, color, active }: { label: string; color?: string; active?: boolean }) {
  const tint = color ?? RivalColors.accentFill;
  return (
    <View style={[styles.chip, { backgroundColor: active ? tint : `${tint}33`, borderColor: tint }]}>
      <Text style={[styles.label, { color: active ? RivalColors.onAccentFill : tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: RivalRadius.full,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  label: { ...RivalType.labelCaps, fontSize: 11 },
});
