import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

export function Brand({ tagline }: { tagline: string }) {
  return (
    <View style={styles.brand}>
      <View style={styles.logo}>
        <Ionicons name="car-sport" size={34} color={colors.onPrimary} />
      </View>
      <Text style={styles.name}>SmartPark</Text>
      <Text style={styles.tagline}>{tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  tagline: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
});
