import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChipGroup } from '@/components/Choices';
import { DataScreen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionTitle } from '@/components/Section';
import { EmptyState, Notice } from '@/components/States';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  dayChipLabel, formatDateLong, formatDateShort, formatDayMonth, formatPrice, formatTimeRange,
  nextDays, toDateKey,
} from '@/lib/format';
import { levelLabels } from '@/lib/labels';
import type { AvailabilityNow, DaySlot, ParkingInfo, Promotion, Reservation } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, radius, spacing, tones } from '@/theme';

type HomeData = {
  parking: ParkingInfo;
  now: AvailabilityNow;
  promotions: Promotion[];
  next: Reservation | null;
};

const DAYS_SHOWN = 7;

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const days = nextDays(DAYS_SHOWN);
  const [dayIndex, setDayIndex] = useState(0);

  const home = useFetch<HomeData>(async () => {
    const [parking, now, promos, reservations] = await Promise.all([
      api.get<ParkingInfo>('/parking'),
      api.get<AvailabilityNow>('/availability'),
      api.get<{ promotions: Promotion[] }>('/promotions'),
      api.get<{ reservations: Reservation[] }>('/reservations'),
    ]);
    const coming = reservations.reservations
      .filter((r) => r.state === 'upcoming' || r.state === 'ongoing')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { parking, now, promotions: promos.promotions, next: coming[0] ?? null };
  });

  const dateKey = toDateKey(days[dayIndex]);
  const day = useFetch<{ slots: DaySlot[] }>(() => api.get(`/availability/day?date=${dateKey}`), dateKey);

  const reserve = (start?: string) =>
    router.navigate({ pathname: '/client/reserve', params: start ? { start, t: String(Date.now()) } : {} });

  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <DataScreen
      state={{ ...home, refresh: () => { home.refresh(); day.refresh(); } }}
      header={<ScreenHeader title={`Bonjour, ${firstName}`} subtitle={home.data?.parking.name} />}>
      {({ parking, now, promotions, next }) => {
        const status = now.is_open ? levelLabels[now.level] : { label: 'Fermé', tone: 'neutral' as const };
        return (
          <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>Places libres maintenant</Text>
                <Badge label={status.label} tone={status.tone} />
              </View>
              <View style={styles.heroCount}>
                <Text style={styles.heroNumber}>{now.free_spots}</Text>
                <Text style={styles.heroTotal}>/ {now.total_spots} places</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroBottom}>
                <View style={styles.heroPrice}>
                  <Text style={styles.heroLabel}>Tarif actuel</Text>
                  <Text style={styles.heroValue}>{formatPrice(now.price_per_hour)} / h</Text>
                </View>
                <View style={styles.heroPrice}>
                  <Text style={styles.heroLabel}>Horaires</Text>
                  <Text style={styles.heroValue}>{parking.open_hour}h00 – {parking.close_hour}h00</Text>
                </View>
              </View>
              {now.promo_applied && <Badge label="Promotion en cours" tone="success" icon="pricetag" />}
              {now.subscription_covered && <Badge label="Inclus dans votre abonnement" tone="primary" icon="star" />}
            </View>

            <Button title="Réserver une place" icon="calendar" onPress={() => reserve()} />

            {next && (
              <>
                <SectionTitle title="Prochaine réservation" />
                <Card onPress={() => router.navigate('/client/history')}>
                  <View style={styles.nextRow}>
                    <View style={styles.nextIcon}>
                      <Ionicons name="car" size={22} color={colors.primary} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        Place {next.spot_number} · {next.zone}
                      </Text>
                      <Text style={styles.cardText}>{formatDateLong(next.start_time)}</Text>
                      <Text style={styles.cardText}>{formatTimeRange(next.start_time, next.end_time)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                </Card>
              </>
            )}

            <SectionTitle title="Disponibilité par créneau" />
            <ChipGroup
              scroll
              value={dayIndex}
              onChange={setDayIndex}
              options={days.map((d, index) => ({
                value: index, label: dayChipLabel(d, index), sublabel: formatDayMonth(d),
              }))}
            />
            <Card style={styles.slotCard}>
              {day.loading ? (
                <View style={styles.slotLoading}><ActivityIndicator color={colors.primary} /></View>
              ) : day.error || !day.data ? (
                <View style={styles.slotError}>
                  <Notice message={day.error ?? 'Une erreur est survenue.'} />
                  <Button title="Réessayer" variant="secondary" small onPress={day.reload} />
                </View>
              ) : day.data.slots.every((slot) => slot.past) ? (
                <EmptyState icon="moon-outline" title="Plus de créneau aujourd'hui"
                  message="Le parking est fermé pour aujourd'hui. Choisissez un autre jour." />
              ) : (
                day.data.slots.filter((slot) => !slot.past).map((slot, index) => (
                  <SlotRow key={slot.start} slot={slot} first={index === 0}
                    basePrice={parking.base_price} onPress={() => reserve(slot.start)} />
                ))
              )}
            </Card>

            <SectionTitle title="Promotions du moment" />
            {promotions.length === 0 ? (
              <Card>
                <EmptyState icon="pricetags-outline" title="Aucune promotion en ce moment"
                  message="Les offres sur les heures creuses apparaîtront ici." />
              </Card>
            ) : (
              promotions.slice(0, 6).map((promo) => (
                <Card key={promo.id} onPress={() => reserve(promo.start)}>
                  <View style={styles.nextRow}>
                    <View style={[styles.nextIcon, { backgroundColor: tones.success.bg }]}>
                      <Ionicons name="pricetag" size={20} color={colors.success} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {formatDateShort(promo.start)} · {formatTimeRange(promo.start, promo.end)}
                      </Text>
                      <Text style={styles.cardText}>
                        {formatPrice(promo.price_per_hour)} / h au lieu de {formatPrice(promo.base_price)}
                      </Text>
                    </View>
                    <View><Badge label={`-${promo.discount_percent} %`} tone="success" /></View>
                  </View>
                </Card>
              ))
            )}
          </>
        );
      }}
    </DataScreen>
  );
}

function SlotRow({ slot, first, basePrice, onPress }: {
  slot: DaySlot; first: boolean; basePrice: number; onPress: () => void;
}) {
  const full = slot.level === 'full';
  const { fg } = tones[levelLabels[slot.level].tone];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={full}
      onPress={onPress}
      style={({ pressed }) => [styles.slotRow, !first && styles.slotBorder, pressed && styles.pressed]}>
      <Text style={styles.slotTime}>{formatTimeRange(slot.start, slot.end)}</Text>
      <View style={styles.slotStatus}>
        <View style={[styles.dot, { backgroundColor: fg }]} />
        <Text style={[styles.slotFree, { color: fg }]} numberOfLines={1}>
          {full ? 'Complet' : `${slot.free_spots} libres`}
        </Text>
      </View>
      <View style={styles.slotPrice}>
        {slot.promo_applied && <Text style={styles.oldPrice}>{formatPrice(basePrice)}</Text>}
        <Text style={[styles.price, slot.promo_applied && { color: colors.success }]}>
          {formatPrice(slot.price_per_hour)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={full ? colors.surface : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  heroLabel: { fontSize: fontSize.sm, color: colors.onPrimaryMuted, flexShrink: 1 },
  heroCount: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  heroNumber: { fontSize: 56, lineHeight: 60, fontWeight: fontWeight.bold, color: colors.onPrimary },
  heroTotal: { fontSize: fontSize.md, color: colors.onPrimaryMuted },
  heroDivider: { height: 1, backgroundColor: colors.onPrimaryMuted, opacity: 0.3 },
  heroBottom: { flexDirection: 'row', gap: spacing.lg },
  heroPrice: { flex: 1, gap: 2 },
  heroValue: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.onPrimary },

  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextIcon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  cardText: { fontSize: fontSize.sm, color: colors.textSecondary },

  slotCard: { paddingVertical: spacing.xs, gap: 0 },
  slotLoading: { paddingVertical: spacing.xxl },
  slotError: { paddingVertical: spacing.md, gap: spacing.md },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  slotBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  slotTime: { width: 104, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  slotStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  slotFree: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flexShrink: 1 },
  slotPrice: { alignItems: 'flex-end' },
  oldPrice: { fontSize: fontSize.xs, color: colors.textMuted, textDecorationLine: 'line-through' },
  price: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
});
