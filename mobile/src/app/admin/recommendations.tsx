import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChipGroup } from '@/components/Choices';
import { Input } from '@/components/Input';
import { DataScreen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionTitle } from '@/components/Section';
import { Sheet } from '@/components/Sheet';
import { EmptyState, Notice } from '@/components/States';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import {
  dayChipLabel, formatDateNumeric, formatDayMonth, formatNumber, formatPercent, formatPrice, formatTimeRange,
  nextDays, toDateKey,
} from '@/lib/format';
import type { Pricing, Recommendation, RecommendationsResponse } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, radius, spacing, tones, type Tone } from '@/theme';

type Action = 'apply' | 'ignore' | 'reset';

const STATUS: Record<Recommendation['status'], { label: string; tone: Tone }> = {
  pending: { label: 'En attente', tone: 'neutral' },
  applied: { label: 'Appliquée', tone: 'success' },
  ignored: { label: 'Ignorée', tone: 'neutral' },
};

const FEEDBACK: Record<Action, string> = {
  apply: 'Recommandation appliquée : les clients voient le nouveau prix.',
  ignore: 'Recommandation ignorée : le prix de base est conservé.',
  reset: 'Décision annulée : le créneau revient au prix de base.',
};

function formatError(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')} %`;
}

function occupancyTone(rate: number): Tone {
  if (rate >= 0.85) return 'danger';
  if (rate <= 0.35) return 'success';
  return 'warning';
}

export default function RecommendationsScreen() {
  const toast = useToast();
  const state = useFetch<RecommendationsResponse>(() => api.get('/admin/recommendations'));
  const [dayKey, setDayKey] = useState(toDateKey(new Date()));
  const [busy, setBusy] = useState<string | null>(null);
  const [editingPrices, setEditingPrices] = useState(false);

  const decide = async (rec: Recommendation, action: Action) => {
    if (busy || !state.data) return;
    setBusy(`${rec.slot_start}:${action}`);
    try {
      const { recommendation } = await api.post<{ recommendation: Recommendation }>(
        '/admin/recommendations/decision', { slot_start: rec.slot_start, action });
      state.setData({
        ...state.data,
        recommendations: state.data.recommendations.map((r) =>
          r.slot_start === recommendation.slot_start ? recommendation : r),
      });
      toast(FEEDBACK[action]);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DataScreen
        state={state}
        header={<ScreenHeader title="Recommandations IA" subtitle="Occupation prévue et prix conseillés" />}>
        {({ recommendations, pricing, metrics, prediction_source }) => {
          const days = nextDays(8)
            .map((date, index) => ({ date, index, key: toDateKey(date) }))
            .filter((d) => recommendations.some((r) => toDateKey(new Date(r.slot_start)) === d.key));
          const activeKey = days.some((d) => d.key === dayKey) ? dayKey : days[0]?.key ?? '';
          const slots = recommendations.filter((r) => toDateKey(new Date(r.slot_start)) === activeKey);
          const count = (kind: Recommendation['kind']) => slots.filter((r) => r.kind === kind).length;

          return (
            <>
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Modèle de prédiction</Text>
                  {metrics && (
                    <Badge label={metrics.dataset === 'real' ? 'Données réelles' : 'Données synthétiques'}
                      tone={metrics.dataset === 'real' ? 'success' : 'warning'} />
                  )}
                </View>
                {prediction_source === 'fallback' || !metrics ? (
                  <Notice tone="warning"
                    message="Modèle non entraîné : les prévisions utilisent la moyenne par jour et par heure de l'historique." />
                ) : (
                  <>
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableHead, styles.flex]}>Modèle</Text>
                      <Text style={[styles.tableHead, styles.tableNumber]}>MAE</Text>
                      <Text style={[styles.tableHead, styles.tableNumber]}>RMSE</Text>
                    </View>
                    {Object.entries(metrics.models).map(([name, m]) => {
                      const best = name === metrics.best_model;
                      return (
                        <View key={name} style={styles.tableRow}>
                          <View style={[styles.flex, styles.modelName]}>
                            <Text style={[styles.tableCell, best && styles.bold]} numberOfLines={1}>{name}</Text>
                            {best && <Badge label="Retenu" tone="primary" icon="trophy" />}
                          </View>
                          <Text style={[styles.tableCell, styles.tableNumber, best && styles.bold]}>
                            {formatError(m.mae)}
                          </Text>
                          <Text style={[styles.tableCell, styles.tableNumber, best && styles.bold]}>
                            {formatError(m.rmse)}
                          </Text>
                        </View>
                      );
                    })}
                    <Text style={styles.muted}>
                      Erreur sur le taux d&apos;occupation (jeu de test). Entraîné sur {formatNumber(metrics.rows)} mesures
                      de {metrics.car_parks} parkings, du {formatDateNumeric(`${metrics.date_from}T12:00:00`)} au{' '}
                      {formatDateNumeric(`${metrics.date_to}T12:00:00`)}.
                    </Text>
                  </>
                )}
              </Card>

              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Tarifs horaires</Text>
                  <Button title="Modifier" variant="ghost" small icon="create-outline"
                    onPress={() => setEditingPrices(true)} />
                </View>
                <View style={styles.prices}>
                  <PriceBox label="Minimum" value={pricing.min_price} />
                  <PriceBox label="Base" value={pricing.base_price} strong />
                  <PriceBox label="Maximum" value={pricing.max_price} />
                </View>
              </Card>

              <SectionTitle title="Créneaux à venir" />
              {days.length === 0 ? (
                <Card>
                  <EmptyState icon="sparkles-outline" title="Aucune recommandation"
                    message="Il n'y a pas de créneau à venir pour le moment." />
                </Card>
              ) : (
                <>
                  <ChipGroup
                    scroll
                    value={activeKey}
                    onChange={setDayKey}
                    options={days.map((d) => ({
                      value: d.key, label: dayChipLabel(d.date, d.index), sublabel: formatDayMonth(d.date),
                    }))}
                  />
                  <Text style={styles.muted}>
                    {count('increase')} hausse{count('increase') > 1 ? 's' : ''} · {count('promotion')} promotion
                    {count('promotion') > 1 ? 's' : ''} · {count('base')} sans changement
                  </Text>
                  {slots.map((rec) => (
                    <RecommendationCard key={rec.slot_start} rec={rec} busy={busy} onDecide={decide} />
                  ))}
                </>
              )}
            </>
          );
        }}
      </DataScreen>

      {state.data && editingPrices && (
        <PricingSheet
          visible
          pricing={state.data.pricing}
          onClose={() => setEditingPrices(false)}
          onSaved={() => {
            setEditingPrices(false);
            toast('Tarifs mis à jour. Les recommandations ont été recalculées.');
            state.refresh();
          }}
        />
      )}
    </>
  );
}

function RecommendationCard({ rec, busy, onDecide }: {
  rec: Recommendation; busy: string | null; onDecide: (rec: Recommendation, action: Action) => void;
}) {
  const tone = occupancyTone(rec.predicted_occupancy);
  const loading = (action: Action) => busy === `${rec.slot_start}:${action}`;
  const changes = rec.kind !== 'base';
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.slotTime}>{formatTimeRange(rec.slot_start, rec.slot_end)}</Text>
        {changes && <Badge {...STATUS[rec.status]} />}
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.muted}>Occupation prévue</Text>
        <Text style={[styles.occupancy, { color: tones[tone].fg }]}>{formatPercent(rec.predicted_occupancy)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, {
          width: `${Math.max(2, Math.round(rec.predicted_occupancy * 100))}%`, backgroundColor: tones[tone].fg,
        }]} />
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceNow}>{formatPrice(rec.current_price)}</Text>
        {changes && rec.status !== 'applied' && (
          <>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            <Text style={[styles.priceNext, { color: rec.kind === 'promotion' ? colors.success : colors.warning }]}>
              {formatPrice(rec.recommended_price)}
            </Text>
          </>
        )}
        <Text style={styles.perHour}>/ h</Text>
        <View style={styles.flex} />
        {rec.kind === 'increase' && <Badge label="Hausse" tone="warning" icon="trending-up" />}
        {rec.kind === 'promotion' && <Badge label="Promotion" tone="success" icon="pricetag" />}
      </View>
      <Text style={styles.reason}>{rec.reason}</Text>

      {changes && rec.status === 'pending' && (
        <View style={styles.actions}>
          <Button title="Ignorer" variant="secondary" small style={styles.flex} disabled={!!busy && !loading('ignore')}
            loading={loading('ignore')} onPress={() => onDecide(rec, 'ignore')} />
          <Button title="Appliquer" small icon="checkmark" style={styles.flex} disabled={!!busy && !loading('apply')}
            loading={loading('apply')} onPress={() => onDecide(rec, 'apply')} />
        </View>
      )}
      {changes && rec.status !== 'pending' && (
        <Button
          title={rec.status === 'applied' ? "Annuler l'application" : 'Réexaminer'}
          variant="secondary" small icon="refresh"
          disabled={!!busy && !loading('reset')} loading={loading('reset')}
          onPress={() => onDecide(rec, 'reset')}
        />
      )}
    </Card>
  );
}

function PriceBox({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={[styles.priceBox, strong && styles.priceBoxStrong]}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.priceBoxValue} numberOfLines={1} adjustsFontSizeToFit>{formatPrice(value)}</Text>
    </View>
  );
}

function PricingSheet({ visible, pricing, onClose, onSaved }: {
  visible: boolean; pricing: Pricing; onClose: () => void; onSaved: () => void;
}) {
  const [base, setBase] = useState(String(pricing.base_price));
  const [min, setMin] = useState(String(pricing.min_price));
  const [max, setMax] = useState(String(pricing.max_price));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const [b, lo, hi] = [base, min, max].map((v) => Number(v.replace(',', '.')));
    if (![b, lo, hi].every((n) => Number.isFinite(n) && n > 0)) {
      setError('Saisissez trois prix valides, supérieurs à zéro.');
      return;
    }
    if (!(lo <= b && b <= hi)) {
      setError('Les prix doivent respecter : minimum ≤ base ≤ maximum.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.put('/admin/pricing', { base_price: b, min_price: lo, max_price: hi });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title="Modifier les tarifs" onClose={onClose}
      footer={<Button title="Enregistrer" onPress={save} loading={saving} />}>
      <Notice tone="primary"
        message="Le prix recommandé reste toujours entre le minimum et le maximum. Les réservations déjà faites ne changent pas." />
      <Input label="Prix de base (par heure)" keyboardType="numeric" value={base} onChangeText={setBase} editable={!saving} />
      <Input label="Prix minimum" keyboardType="numeric" value={min} onChangeText={setMin} editable={!saving}
        hint="Plancher des promotions." />
      <Input label="Prix maximum" keyboardType="numeric" value={max} onChangeText={setMax} editable={!saving}
        hint="Plafond des hausses en forte demande." />
      {error && <Notice message={error} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flexShrink: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  muted: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
  bold: { fontWeight: fontWeight.bold },

  tableRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  tableHead: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold },
  tableCell: { fontSize: fontSize.sm, color: colors.text, flexShrink: 1 },
  tableNumber: { width: 60, textAlign: 'right' },
  modelName: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  prices: { flexDirection: 'row', gap: spacing.sm },
  priceBox: {
    flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: 2,
  },
  priceBoxStrong: { backgroundColor: colors.primarySoft },
  priceBoxValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },

  slotTime: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  occupancy: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  priceNow: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  priceNext: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  perHour: { fontSize: fontSize.sm, color: colors.textSecondary },
  reason: { fontSize: fontSize.sm, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.md },
});
