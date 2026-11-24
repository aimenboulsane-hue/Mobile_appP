import { StyleSheet, Text, View } from 'react-native';

import { dayChipLabel, formatDayMonth, formatDuration, nextDays } from '@/lib/format';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

import { ChipGroup } from './Choices';

export type SlotValue = {
  dayIndex: number;
  startHour: number | null;
  duration: number;
};

type Props = {
  value: SlotValue;
  onChange: (value: SlotValue) => void;
  openHour: number;
  closeHour: number;
};

export const SLOT_DAYS = 14;
const DURATIONS = [0.5, 1, 1.5, 2, 3, 4, 6, 9];

export function slotToDates(value: SlotValue): { start: Date; end: Date } | null {
  if (value.startHour === null) return null;
  const start = nextDays(SLOT_DAYS)[value.dayIndex];
  start.setHours(Math.floor(value.startHour), (value.startHour % 1) * 60, 0, 0);
  const end = new Date(start.getTime() + value.duration * 3600 * 1000);
  return { start, end };
}

export function dateToSlot(start: Date, duration = 1): SlotValue {
  const today = nextDays(1)[0];
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  const dayIndex = Math.round((day.getTime() - today.getTime()) / (24 * 3600 * 1000));
  if (dayIndex < 0 || dayIndex >= SLOT_DAYS) return { dayIndex: 0, startHour: null, duration };
  return { dayIndex, startHour: start.getHours() + start.getMinutes() / 60, duration };
}

export function SlotPicker({ value, onChange, openHour, closeHour }: Props) {
  const days = nextDays(SLOT_DAYS);
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  const starts: number[] = [];
  for (let h = openHour; h < closeHour; h += 0.5) starts.push(h);
  const isPast = (dayIndex: number, hour: number) => dayIndex === 0 && hour <= nowHour;
  const maxDuration = value.startHour === null ? closeHour - openHour : closeHour - value.startHour;

  const change = (patch: Partial<SlotValue>) => {
    const next = { ...value, ...patch };
    if (next.startHour !== null && isPast(next.dayIndex, next.startHour)) next.startHour = null;
    if (next.startHour !== null && next.startHour + next.duration > closeHour) {
      next.duration = Math.max(...DURATIONS.filter((d) => next.startHour! + d <= closeHour));
    }
    onChange(next);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.group}>
        <Text style={styles.label}>Jour</Text>
        <ChipGroup
          scroll
          value={value.dayIndex}
          onChange={(dayIndex) => change({ dayIndex })}
          options={days.map((day, index) => ({
            value: index,
            label: dayChipLabel(day, index),
            sublabel: formatDayMonth(day),
          }))}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Heure de début</Text>
        <ChipGroup
          value={value.startHour}
          onChange={(startHour) => change({ startHour })}
          options={starts.map((hour) => ({
            value: hour,
            label: `${Math.floor(hour)}h${hour % 1 ? '30' : '00'}`,
            disabled: isPast(value.dayIndex, hour),
          }))}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Durée</Text>
        <ChipGroup
          value={value.duration}
          onChange={(duration) => change({ duration })}
          options={DURATIONS.filter((d) => d <= closeHour - openHour).map((d) => ({
            value: d,
            label: formatDuration(d),
            disabled: d > maxDuration,
          }))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.lg },
  group: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
});
