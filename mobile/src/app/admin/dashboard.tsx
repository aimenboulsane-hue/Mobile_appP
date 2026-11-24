import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/Choices';
import { LineChart } from '@/components/LineChart';
import { DataScreen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionTitle } from '@/components/Section';
import { EmptyState } from '@/components/States';
import { CURRENCY } from '@/config';
import { api } from '@/lib/api';
import { formatDateLong, formatDayMonth, formatPercent, formatPrice } from '@/lib/format';
import type { Dashboard } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, radius, spacing, tones, type Tone } from '@/theme';

function compact(value: number): string {
  if (value >= 1000) return `${String(Math.round(value / 100) / 10).replace('.', ',')} k`;
  return String(Math.round(value));
}

export default function DashboardScreen() {
  const [days, setDays] = useState(30);
  const state = useFetch<Dashboard>(() => api.get(`/admin/dashboard?days=${days}`), String(days));

  return (
    <DataScreen
      state={state}
      header={<ScreenHeader title="Tableau de bord" subtitle={formatDateLong(new Date())} />}>
      {({ today, period, series }) => {
        const hasActivity = series.some((d) => d.revenue > 0 || d.occupancy > 0);
        const label = (date: string) => formatDayMonth(`${date}T12:00:00`);
        return (
          <>
            <SectionTitle title="Aujourd'hui" />
            <View style={styles.grid}>
              <Stat icon="cash-outline" tone="primary" label="Revenus du jour" value={formatPrice(today.revenue)} />
              <Stat icon="pie-chart-outline" tone="success" label="Taux d'occupation" value={formatPercent(today.occupancy)} />
            </View>
            <View style={styles.grid}>
              <Stat icon="calendar-outline" tone="warning" label="Réservations actives" value={String(today.active_reservations)} />
              <Stat icon="people-outline" tone="primary" label="Abonnés actifs" value={String(today.active_subscribers)} />
            </View>

            <SectionTitle title="Évolution" />
            <SegmentedControl
              value={days}
              onChange={setDays}
              options={[
                { value: 7, label: '7 jours' },
                { value: 30, label: '30 jours' },
                { value: 90, label: '90 jours' },
              ]}
            />

            {!hasActivity ? (
              <Card>
                <EmptyState icon="bar-chart-outline" title="Pas encore de données"
                  message="Les graphiques apparaîtront dès les premières réservations." />
              </Card>
            ) : (
              <>
                <Card>
                  <View>
                    <Text style={styles.chartTitle}>Revenus par jour ({CURRENCY})</Text>
                    <Text style={styles.chartValue}>{formatPrice(period.revenue)}</Text>
                    <Text style={styles.chartHint}>Total sur {period.days} jours</Text>
                  </View>
                  <LineChart
                    points={series.map((d) => ({ label: label(d.date), value: d.revenue }))}
                    formatValue={compact}
                  />
                </Card>
                <Card>
                  <View>
                    <Text style={styles.chartTitle}>Taux d&apos;occupation par jour</Text>
                    <Text style={styles.chartValue}>{formatPercent(period.occupancy)}</Text>
                    <Text style={styles.chartHint}>Moyenne sur {period.days} jours</Text>
                  </View>
                  <LineChart
                    points={series.map((d) => ({ label: label(d.date), value: d.occupancy }))}
                    formatValue={formatPercent}
                    maxValue={1}
                  />
                </Card>
              </>
            )}
          </>
        );
      }}
    </DataScreen>
  );
}

function Stat({ icon, tone, label, value }: {
  icon: keyof typeof Ionicons.glyphMap; tone: Tone; label: string; value: string;
}) {
  return (
    <Card style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tones[tone].bg }]}>
        <Ionicons name={icon} size={20} color={tones[tone].fg} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: spacing.xs },
  statIcon: {
    width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  statLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  chartTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  chartValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  chartHint: { fontSize: fontSize.xs, color: colors.textMuted },
});
