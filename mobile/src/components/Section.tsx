import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

export function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.lg },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowValue: { flex: 1, textAlign: 'right', fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  rowValueStrong: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  divider: { height: 1, backgroundColor: colors.border },
});
