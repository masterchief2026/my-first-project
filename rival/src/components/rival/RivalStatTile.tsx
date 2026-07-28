import { StyleSheet, Text, View } from 'react-native';
import { RivalCard } from './RivalCard';
import { RivalColors, RivalType } from '../../constants/rivalTheme';

// The 3-4 stat-tile grid pattern used on Home/Profile/League (streak, level,
// days-to-race, distance, etc). icon is a single emoji/glyph to keep this
// platform-agnostic — swap for a real icon set once one is chosen.
export function RivalStatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon?: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <RivalCard style={styles.tile}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </RivalCard>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'flex-start', gap: 4 },
  icon: { fontSize: 20, marginBottom: 4 },
  label: { ...RivalType.labelCaps, color: RivalColors.textSecondary },
  value: { ...RivalType.metricLarge, color: RivalColors.textPrimary },
  sub: { ...RivalType.bodyMd, fontSize: 13, color: RivalColors.textSecondary },
});
