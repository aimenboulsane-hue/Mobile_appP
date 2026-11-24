import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/Choices';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataScreen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { formatDateLong, formatDateNumeric, formatPrice, formatTime, formatTimeRange } from '@/lib/format';
import { paymentLabels, paymentMethodLabel, reservationLabels } from '@/lib/labels';
import type { Payment, Reservation } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

type Data = { reservations: Reservation[]; payments: Payment[] };
type Tab = 'reservations' | 'payments';

export default function HistoryScreen() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('reservations');
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const state = useFetch<Data>(async () => {
    const [reservations, payments] = await Promise.all([
      api.get<{ reservations: Reservation[] }>('/reservations'),
      api.get<{ payments: Payment[] }>('/payments'),
    ]);
    return { reservations: reservations.reservations, payments: payments.payments };
  });

  const cancel = async () => {
    if (!toCancel || cancelling) return;
    setCancelling(true);
    try {
      await api.post(`/reservations/${toCancel.id}/cancel`);
      toast(toCancel.paid_with_subscription
        ? 'Réservation annulée.'
        : 'Réservation annulée. Votre paiement a été remboursé.');
      state.refresh();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setCancelling(false);
      setToCancel(null);
    }
  };

  return (
    <>
      <DataScreen
        state={state}
        header={
          <View>
            <ScreenHeader title="Historique" subtitle="Vos réservations et vos paiements" />
            <View style={styles.tabs}>
              <SegmentedControl
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'reservations', label: 'Réservations' },
                  { value: 'payments', label: 'Paiements' },
                ]}
              />
            </View>
          </View>
        }>
        {({ reservations, payments }) =>
          tab === 'reservations' ? (
            reservations.length === 0 ? (
              <EmptyState icon="calendar-outline" title="Aucune réservation"
                message="Vos réservations apparaîtront ici." actionLabel="Réserver une place"
                onAction={() => router.navigate('/client/reserve')} />
            ) : (
              reservations.map((r) => (
                <Card key={r.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.title} numberOfLines={1}>
                      {r.spot_number ? `Place ${r.spot_number} · ${r.zone}` : 'Place supprimée'}
                    </Text>
                    <Badge {...reservationLabels[r.state]} />
                  </View>
                  <Line icon="calendar-outline" text={formatDateLong(r.start_time)} />
                  <Line icon="time-outline" text={formatTimeRange(r.start_time, r.end_time)} />
                  <View style={styles.rowBetween}>
                    <Line icon="cash-outline"
                      text={r.paid_with_subscription ? 'Inclus dans l\'abonnement' : formatPrice(r.total_price)} />
                    {r.promo_applied && <Badge label="Promotion" tone="success" icon="pricetag" />}
                    {r.payment_status === 'refunded' && <Badge {...paymentLabels.refunded} />}
                  </View>
                  {r.state === 'upcoming' && (
                    <Button title="Annuler la réservation" variant="secondary" small icon="close-circle-outline"
                      onPress={() => setToCancel(r)} />
                  )}
                </Card>
              ))
            )
          ) : payments.length === 0 ? (
            <EmptyState icon="receipt-outline" title="Aucun paiement"
              message="Vos paiements de réservations et d'abonnements apparaîtront ici." />
          ) : (
            payments.map((p) => (
              <Card key={p.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.title} numberOfLines={1}>{p.label}</Text>
                  <Text style={[styles.amount, p.status === 'refunded' && styles.refunded]}>
                    {formatPrice(p.amount)}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.text} numberOfLines={1}>
                    {formatDateNumeric(p.created_at)} à {formatTime(p.created_at)} · {paymentMethodLabel(p)}
                  </Text>
                  <Badge {...paymentLabels[p.status]} />
                </View>
              </Card>
            ))
          )
        }
      </DataScreen>

      <ConfirmDialog
        visible={toCancel !== null}
        title="Annuler cette réservation ?"
        message={toCancel
          ? `${formatDateLong(toCancel.start_time)}, ${formatTimeRange(toCancel.start_time, toCancel.end_time)}. `
            + (toCancel.paid_with_subscription ? 'La place sera libérée.' : 'La place sera libérée et votre paiement remboursé.')
          : ''}
        confirmLabel="Oui, annuler"
        cancelLabel="Non, garder"
        destructive
        loading={cancelling}
        onConfirm={cancel}
        onCancel={() => setToCancel(null)}
      />
    </>
  );
}

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.text} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  line: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flexShrink: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  refunded: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
