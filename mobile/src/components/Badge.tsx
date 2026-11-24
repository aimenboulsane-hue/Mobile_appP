import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { fontSize, fontWeight, radius, spacing, tones, type Tone } from '@/theme';

type Props = {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function Badge({ label, tone = 'neutral', icon }: Props) {
  const { fg, bg } = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
