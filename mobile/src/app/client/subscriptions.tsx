import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PaymentForm } from '@/components/PaymentForm';
import { DataScreen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoRow, SectionTitle } from '@/components/Section';
import { Sheet } from '@/components/Sheet';
import { EmptyState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { daysUntil, formatDateLong, formatPrice } from '@/lib/format';
import { subscriptionLabels } from '@/lib/labels';
import type { Plan, Subscription } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type Data = { plans: Plan[]; active: Subscription | null; history: Subscription[] };

const PLAN_DETAILS: Record<Plan['code'], { duration: string; months: number }> = {
  monthly: { duration: '30 jours', months: 1 },
  quarterly: { duration: '90 jours', months: 3 },
  annual: { duration: '365 jours', months: 12 },
};

export default function SubscriptionsScreen() {
  const toast = useToast();
  const [selected, setSelected] = useState<Plan | null>(null);

  const state = useFetch<Data>(async () => {
    const [plans, mine] = await Promise.all([
      api.get<{ plans: Plan[] }>('/plans'),
      api.get<{ active: Subscription | null; history: Subscription[] }>('/subscriptions/me'),
    ]);
    return { plans: plans.plans, ...mine };
  });

  const pay = async (cardLast4: string) => {
    if (!selected) return;
    await api.post('/subscriptions', { plan_id: selected.id, card_last4: cardLast4 });
    setSelected(null);
    toast('Abonnement activé. Vos réservations sont maintenant incluses.');
    state.refresh();
  };

  return (
    <>
      <DataScreen
        state={state}
        header={<ScreenHeader title="Abonnements" subtitle="Réservez sans payer à l'heure" />}>
        {({ plans, active, history }) => {
          const daysLeft = active ? daysUntil(active.end_date) : 0;
          const past = history.filter((s) => s.id !== active?.id);
          return (
            <>
              <SectionTitle title="Mon abonnement" />
              {active ? (
                <Card style={styles.activeCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.planName}>Formule {active.plan_name.toLowerCase()}</Text>
                    <Badge {...subscriptionLabels.active} icon="checkmark-circle" />
                  </View>
                  <InfoRow label="Début" value={formatDateLong(active.start_date)} />
                  <InfoRow label="Fin" value={formatDateLong(active.end_date)} />
                  <InfoRow label="Temps restant" value={`${daysLeft} jour${daysLeft > 1 ? 's' : ''}`} />
                </Card>
              ) : (
                <Card>
                  <EmptyState icon="card-outline" title="Aucun abonnement actif"
                    message="Choisissez une formule ci-dessous pour réserver sans payer à chaque fois." />
                </Card>
              )}

              <SectionTitle title="Formules" />
              {plans.map((plan) => {
                const details = PLAN_DETAILS[plan.code];
                return (
                  <Card key={plan.id}>
                    <View style={styles.rowBetween}>
                      <View style={styles.flex}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.muted}>{details.duration}</Text>
                      </View>
                      <View style={styles.priceBox}>
                        <Text style={styles.price}>{formatPrice(plan.price)}</Text>
                        {details.months > 1 && (
                          <Text style={styles.muted}>soit {formatPrice(plan.price / details.months)} / mois</Text>
                        )}
                      </View>
                    </View>
                    <Feature text="Réservations illimitées, sans paiement à l'heure" />
                    <Feature text="Annulation gratuite de vos réservations" />
                    <Button
                      title={active ? 'Abonnement déjà actif' : 'Choisir cette formule'}
                      variant={active ? 'secondary' : 'primary'}
                      disabled={!!active}
                      onPress={() => setSelected(plan)}
                    />
                  </Card>
                );
              })}

              {past.length > 0 && (
                <>
                  <SectionTitle title="Abonnements précédents" />
                  {past.map((sub) => (
                    <Card key={sub.id}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.planName}>Formule {sub.plan_name.toLowerCase()}</Text>
                        <Badge {...subscriptionLabels[sub.state]} />
                      </View>
                      <Text style={styles.muted}>
                        Du {formatDateLong(sub.start_date)} au {formatDateLong(sub.end_date)}
                      </Text>
                    </Card>
                  ))}
                </>
              )}
            </>
          );
        }}
      </DataScreen>

      <Sheet visible={selected !== null} title="Paiement de l'abonnement" onClose={() => setSelected(null)}>
        {selected && (
          <PaymentForm amount={selected.price} description={`Abonnement ${selected.name.toLowerCase()}`} onPay={pay} />
        )}
      </Sheet>
    </>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={styles.feature}>
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  activeCard: { borderColor: colors.primary, borderWidth: 2, borderRadius: radius.lg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  planName: { flexShrink: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  muted: { fontSize: fontSize.sm, color: colors.textSecondary },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
});
