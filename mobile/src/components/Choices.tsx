import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

export type Option<T> = { value: T; label: string; sublabel?: string; disabled?: boolean };

type Props<T> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string | number>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChipGroup<T extends string | number>({ options, value, onChange, scroll }: Props<T> & { scroll?: boolean }) {
  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={String(option.value)}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: !!option.disabled }}
        disabled={option.disabled}
        onPress={() => onChange(option.value)}
        style={[styles.chip, selected && styles.chipSelected, option.disabled && styles.chipDisabled]}>
        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option.label}</Text>
        {option.sublabel && (
          <Text style={[styles.chipSublabel, selected && styles.chipLabelSelected]}>{option.sublabel}</Text>
        )}
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}
        contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
        {chips}
      </ScrollView>
    );
  }
  return <View style={styles.chipWrap}>{chips}</View>;
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  segmentSelected: { backgroundColor: colors.primary },
  segmentLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  segmentLabelSelected: { color: colors.onPrimary, fontWeight: fontWeight.semibold },

  chipScroll: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.35 },
  chipLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  chipSublabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  chipLabelSelected: { color: colors.onPrimary },
});
