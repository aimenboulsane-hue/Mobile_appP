import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing, touchSize } from '@/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  password?: boolean;
};

export function Input({ label, error, hint, icon, password, style, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.focused, !!error && styles.invalid]}>
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} />}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={password && hidden}
          autoCapitalize={password ? 'none' : inputProps.autoCapitalize}
          autoCorrect={false}
          {...inputProps}
          onFocus={(e) => { setFocused(true); inputProps.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); inputProps.onBlur?.(e); }}
          style={[styles.input, style]}
        />
        {password && (
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Afficher le mot de passe' : 'Masquer le mot de passe'}
            onPress={() => setHidden(!hidden)}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  field: {
    minHeight: touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.md,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  error: { fontSize: fontSize.xs, color: colors.danger },
  hint: { fontSize: fontSize.xs, color: colors.textMuted },
});
