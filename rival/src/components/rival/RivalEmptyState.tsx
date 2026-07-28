import { StyleSheet, Text, View } from 'react-native';
import { RivalColors, RivalType } from '../../constants/rivalTheme';

export function RivalEmptyState({ icon, title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  icon: { fontSize: 32, marginBottom: 4 },
  title: { ...RivalType.bodyLg, color: RivalColors.textPrimary, textAlign: 'center' },
  sub: { ...RivalType.bodyMd, color: RivalColors.textSecondary, textAlign: 'center' },
});
