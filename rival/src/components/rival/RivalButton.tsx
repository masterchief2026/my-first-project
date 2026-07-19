import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { RivalColors, RivalRadius, RivalType } from '../../constants/rivalTheme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'text';

export function RivalButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'destructive' && styles.destructive,
        variant === 'text' && styles.text,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? RivalColors.onAccentFill : RivalColors.textPrimary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'destructive' && styles.labelDestructive,
            variant === 'text' && styles.labelText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RivalRadius.DEFAULT,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: RivalColors.accentFill },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: RivalColors.outline,
  },
  destructive: { backgroundColor: 'transparent' },
  text: { backgroundColor: 'transparent', paddingHorizontal: 8 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { ...RivalType.titleMd, fontSize: 16, fontWeight: '600' },
  labelPrimary: { color: RivalColors.onAccentFill },
  labelSecondary: { color: RivalColors.textPrimary },
  labelDestructive: { color: RivalColors.error },
  labelText: { color: RivalColors.accentText },
});
