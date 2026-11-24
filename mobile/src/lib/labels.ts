import type { Tone } from '@/theme';

import type { Level, Payment, Reservation, Spot, Subscription } from './types';

type Label = { label: string; tone: Tone };

export const levelLabels: Record<Level, Label> = {
  free: { label: 'Disponible', tone: 'success' },
  limited: { label: 'Presque complet', tone: 'warning' },
  full: { label: 'Complet', tone: 'danger' },
};

export const reservationLabels: Record<Reservation['state'], Label> = {
  upcoming: { label: 'À venir', tone: 'primary' },
  ongoing: { label: 'En cours', tone: 'success' },
  completed: { label: 'Terminée', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

export const paymentLabels: Record<Payment['status'], Label> = {
  paid: { label: 'Payé', tone: 'success' },
  refunded: { label: 'Remboursé', tone: 'warning' },
};

export const subscriptionLabels: Record<Subscription['state'], Label> = {
  active: { label: 'Actif', tone: 'success' },
  expired: { label: 'Expiré', tone: 'neutral' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

export const spotLabels: Record<Spot['status'], Label> = {
  available: { label: 'En service', tone: 'success' },
  out_of_service: { label: 'Hors service', tone: 'danger' },
};

export function paymentMethodLabel(payment: Payment): string {
  return payment.method === 'cash' ? 'Espèces' : `Carte •••• ${payment.card_last4}`;
}
