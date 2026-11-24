import { CURRENCY } from '@/config';

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août',
  'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (n: number) => String(n).padStart(2, '0');

const NBSP = ' ';

export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function formatPrice(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const [whole, cents] = rounded.toFixed(2).split('.');
  return `${formatNumber(Number(whole))}${cents === '00' ? '' : ',' + cents}${NBSP}${CURRENCY}`;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

export function formatTime(value: string | Date): string {
  const d = new Date(value);
  return `${d.getHours()}h${pad(d.getMinutes())}`;
}

export function formatDateLong(value: string | Date): string {
  const d = new Date(value);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(value: string | Date): string {
  const d = new Date(value);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatDayMonth(value: string | Date): string {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatDateNumeric(value: string | Date): string {
  const d = new Date(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatTimeRange(start: string | Date, end: string | Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const minutes = Math.round((hours - h) * 60);
  if (h === 0) return `${minutes} min`;
  return minutes ? `${h} h ${pad(minutes)}` : `${h} h`;
}

export function dayChipLabel(day: Date, index: number): string {
  if (index === 0) return 'Auj.';
  if (index === 1) return 'Demain';
  return DAYS_SHORT[day.getDay()];
}

export function toDateKey(day: Date): string {
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function nextDays(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

export function daysUntil(value: string | Date): number {
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}
