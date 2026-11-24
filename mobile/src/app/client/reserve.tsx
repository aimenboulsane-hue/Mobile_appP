import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PaymentForm } from '@/components/PaymentForm';
import { DataScreen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Divider, InfoRow } from '@/components/Section';
import { dateToSlot, SlotPicker, slotToDates, type SlotValue } from '@/components/SlotPicker';
import { Notice } from '@/components/States';
import { api, errorMessage } from '@/lib/api';
import { formatDateLong, formatDuration, formatPrice, formatTimeRange } from '@/lib/format';
import { levelLabels } from '@/lib/labels';
import type { ParkingInfo, Quote, Reservation } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, spacing, tones } from '@/theme';

type Step = 'slot' | 'summary' | 'payment' | 'done';

const EMPTY_SLOT: SlotValue = { dayIndex: 0, startHour: null, duration: 1 };

const TITLES: Record<Step, { title: string; subtitle: string }> = {
  slot: { title: 'Réserver', subtitle: 'Étape 1 sur 3 · Choisissez votre créneau' },
  summary: { title: 'Récapitulatif', subtitle: 'Étape 2 sur 3 · Vérifiez votre réservation' },
  payment: { title: 'Paiement', subtitle: 'Étape 3 sur 3 · Paiement simulé' },
  done: { title: 'Confirmation', subtitle: 'Votre place vous attend' },
};

export default function ReserveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ start?: string; t?: string }>();
  const parking = useFetch<ParkingInfo>(() => api.get('/parking'));

  const [step, setStep] = useState<Step>('slot');
  const [slot, setSlot] = useState<SlotValue>(EMPTY_SLOT);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);

  const dates = slotToDates(slot);
  const startIso = dates?.start.toISOString() ?? null;
  const endIso = dates?.end.toISOString() ?? null;

  useEffect(() => {
    if (params.start) {
      setSlot(dateToSlot(new Date(params.start)));
      setStep('slot');
    }
  }, [params.start, params.t]);

  const loadQuote = useCallback(async () => {
    if (!startIso || !endIso) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    setQuoteLoading(true);
    try {
      setQuote(await api.get<Quote>(`/availability?start=${startIso}&end=${endIso}`));
      setQuoteError(null);
    } catch (e) {
      setQuote(null);
      setQuoteError(errorMessage(e));
    } finally {
      setQuoteLoading(false);
    }
  }, [startIso, endIso]);

  useEffect(() => {
    if (step === 'slot') loadQuote();
  }, [loadQuote, step]);

  const back = useCallback(() => {
    setConfirmError(null);
    setStep((current) => (current === 'payment' ? 'summary' : 'slot'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 'summary' || step === 'payment') {
          back();
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [step, back]),
  );

  const confirm = async (cardLast4?: string) => {
    const created = await api.post<{ reservation: Reservation }>('/reservations', {
      start_time: startIso, end_time: endIso, card_last4: cardLast4,
    });
    setReservation(created.reservation);
    setStep('done');
  };

  const confirmWithSubscription = async () => {
    if (confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await confirm();
    } catch (e) {
      setConfirmError(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  };

  const restart = () => {
    setSlot(EMPTY_SLOT);
    setQuote(null);
    setReservation(null);
    setConfirmError(null);
    setStep('slot');
  };

  const canContinue = !!quote && quote.free_spots > 0 && !quoteLoading;

  const footer =
    step === 'slot' ? (
      <Button title="Continuer" icon="arrow-forward" disabled={!canContinue} onPress={() => setStep('summary')} />
    ) : step === 'summary' && quote ? (
      quote.subscription_covered
        ? <Button title="Confirmer la réservation" icon="checkmark" loading={confirming} onPress={confirmWithSubscription} />
        : <Button title={`Payer ${formatPrice(quote.total_price)}`} icon="card" onPress={() => setStep('payment')} />
    ) : undefined;

  return (
    <DataScreen
      state={parking}
      footer={footer}
      header={
        <ScreenHeader {...TITLES[step]} onBack={step === 'summary' || step === 'payment' ? back : undefined} />
      }>
      {(info) => (
        <>
          {step === 'slot' && (
            <>
              <SlotPicker value={slot} onChange={setSlot} openHour={info.open_hour} closeHour={info.close_hour} />
              <Card>
                {!dates ? (
                  <View style={styles.hint}>
                    <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                    <Text style={styles.hintText}>
                      Choisissez une heure de début pour voir les places disponibles et le prix.
                    </Text>
                  </View>
                ) : quoteLoading && !quote ? (
                  <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
                ) : quoteError ? (
                  <>
                    <Notice message={quoteError} />
                    <Button title="Réessayer" variant="secondary" small onPress={loadQuote} />
                  </>
                ) : quote ? (
                  <>
                    <View style={styles.quoteTop}>
                      <View style={styles.flex}>
                        <Text style={styles.quoteLabel}>Places disponibles</Text>
                        <Text style={[styles.quoteNumber, { color: tones[levelLabels[quote.level].tone].fg }]}>
                          {quote.free_spots} <Text style={styles.quoteTotal}>/ {quote.total_spots}</Text>
                        </Text>
                      </View>
                      <Badge {...levelLabels[quote.level]} />
                    </View>
                    <Divider />
                    <InfoRow label="Tarif horaire" value={`${formatPrice(quote.price_per_hour)} / h`} />
                    <InfoRow label="Total" strong
                      value={quote.subscription_covered ? 'Inclus' : formatPrice(quote.total_price)} />
                    {quote.promo_applied && !quote.subscription_covered && (
                      <Badge label="Promotion appliquée sur ce créneau" tone="success" icon="pricetag" />
                    )}
                    {quote.subscription_covered && (
                      <Badge label="Inclus dans votre abonnement" tone="primary" icon="star" />
                    )}
                    {quote.free_spots === 0 && (
                      <Notice message="Ce créneau est complet. Choisissez un autre horaire." tone="warning" />
                    )}
                  </>
                ) : null}
              </Card>
            </>
          )}

          {step === 'summary' && dates && quote && (
            <>
              <Card>
                <InfoRow label="Parking" value={info.name} />
                <InfoRow label="Date" value={formatDateLong(dates.start)} />
                <InfoRow label="Horaire" value={formatTimeRange(dates.start, dates.end)} />
                <InfoRow label="Durée" value={formatDuration(quote.hours)} />
                <InfoRow label="Place" value="Attribuée automatiquement" />
                <Divider />
                <InfoRow label="Tarif horaire" value={`${formatPrice(quote.price_per_hour)} / h`} />
                {quote.promo_applied && !quote.subscription_covered && (
                  <Badge label="Promotion appliquée" tone="success" icon="pricetag" />
                )}
                <InfoRow label="Total à payer" strong
                  value={quote.subscription_covered ? formatPrice(0) : formatPrice(quote.total_price)} />
              </Card>
              {quote.subscription_covered && (
                <Notice tone="primary"
                  message="Votre abonnement est actif : cette réservation est incluse, sans paiement à l'heure." />
              )}
              {confirmError && <Notice message={confirmError} />}
              <Text style={styles.small}>
                Annulation gratuite jusqu&apos;au début de la réservation. Le paiement est alors remboursé.
              </Text>
            </>
          )}

          {step === 'payment' && dates && quote && (
            <PaymentForm
              amount={quote.total_price}
              description={`${formatDateLong(dates.start)}\n${formatTimeRange(dates.start, dates.end)}`}
              onPay={confirm}
            />
          )}

          {step === 'done' && reservation && (
            <>
              <View style={styles.success}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={40} color={colors.success} />
                </View>
                <Text style={styles.successTitle}>Réservation confirmée</Text>
                <Text style={styles.successText}>
                  {reservation.paid_with_subscription
                    ? 'Réservation incluse dans votre abonnement.'
                    : `Paiement de ${formatPrice(reservation.total_price)} accepté.`}
                </Text>
              </View>
              <Card>
                <InfoRow label="Place" strong value={`${reservation.spot_number} · ${reservation.zone}`} />
                <Divider />
                <InfoRow label="Date" value={formatDateLong(reservation.start_time)} />
                <InfoRow label="Horaire" value={formatTimeRange(reservation.start_time, reservation.end_time)} />
                <InfoRow label="Montant" value={formatPrice(reservation.total_price)} />
              </Card>
              <Button title="Voir mes réservations" icon="time" onPress={() => { restart(); router.navigate('/client/history'); }} />
              <Button title="Nouvelle réservation" variant="secondary" onPress={restart} />
            </>
          )}
        </>
      )}
    </DataScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hintText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  loading: { paddingVertical: spacing.xl },
  quoteTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quoteLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  quoteNumber: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  quoteTotal: { fontSize: fontSize.md, fontWeight: fontWeight.regular, color: colors.textSecondary },
  small: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  success: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  successIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.successSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  successText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
});
