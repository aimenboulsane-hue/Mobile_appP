import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing, touchSize } from '@/theme';

import type { Option } from './Choices';
import { Sheet } from './Sheet';
import { EmptyState } from './States';

type Props<T> = {
  label: string;
  placeholder: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
};

export function SelectField<T extends string | number>({ label, placeholder, options, value, onChange, error }: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.field, !!error && styles.invalid]}>
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.length === 0 && <EmptyState title="Aucun choix disponible" />}
        <View>
          {options.map((item) => (
            <Pressable
              key={String(item.value)}
              accessibilityRole="button"
              onPress={() => { onChange(item.value); setOpen(false); }}
              style={styles.option}>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel} numberOfLines={1}>{item.label}</Text>
                {item.sublabel && <Text style={styles.optionSublabel} numberOfLines={1}>{item.sublabel}</Text>}
              </View>
              {item.value === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      </Sheet>
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
  invalid: { borderColor: colors.danger },
  value: { flex: 1, fontSize: fontSize.md, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { fontSize: fontSize.xs, color: colors.danger },
  option: {
    minHeight: touchSize + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.medium },
  optionSublabel: { fontSize: fontSize.sm, color: colors.textSecondary },
});
