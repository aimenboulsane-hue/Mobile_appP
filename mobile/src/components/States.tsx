import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing, tones, type Tone } from '@/theme';

import { Button } from './Button';

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{label}</Text>
    </View>
  );
}

type EmptyProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction }: EmptyProps) {
  return (
    <View style={styles.container}>
      <IconCircle icon={icon} tone="primary" />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={styles.action} />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <IconCircle icon="cloud-offline-outline" tone="danger" />
      <Text style={styles.title}>Oups, un problème est survenu</Text>
      <Text style={styles.message}>{message}</Text>
      <Button title="Réessayer" icon="refresh" onPress={onRetry} style={styles.action} />
    </View>
  );
}

export function Notice({ message, tone = 'danger' }: { message: string; tone?: Tone }) {
  const { fg, bg } = tones[tone];
  const icon = tone === 'danger' ? 'alert-circle' : tone === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={18} color={fg} />
      <Text style={[styles.noticeText, { color: fg }]}>{message}</Text>
    </View>
  );
}

function IconCircle({ icon, tone }: { icon: keyof typeof Ionicons.glyphMap; tone: Tone }) {
  return (
    <View style={[styles.circle, { backgroundColor: tones[tone].bg }]}>
      <Ionicons name={icon} size={32} color={tones[tone].fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
  },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, textAlign: 'center' },
  message: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  action: { alignSelf: 'center', marginTop: spacing.sm, minWidth: 160 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
});
