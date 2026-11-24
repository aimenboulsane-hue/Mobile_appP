import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataScreen } from '@/components/Screen';
import { EmptyState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { api, errorMessage } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, spacing, touchSize } from '@/theme';

export type FormProps<T> = {
  item: T | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

type Props<T> = {
  header: React.ReactNode;
  toolbar?: React.ReactNode;
  fetchKey?: string;
  fetcher: () => Promise<T[]>;
  keyOf: (item: T) => number;
  addLabel: string;
  countLabel: (count: number) => string;
  empty: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string };
  renderRow: (item: T) => { title: string; lines: string[]; badges?: React.ReactNode };
  canEdit?: (item: T) => boolean;
  deletePath: (item: T) => string;
  deleteTitle: string;
  deleteMessage: (item: T) => string;
  deletedMessage: string;
  Form: React.ComponentType<FormProps<T>>;
};

export function CrudSection<T>({
  header, toolbar, fetchKey, fetcher, keyOf, addLabel, countLabel, empty, renderRow, canEdit,
  deletePath, deleteTitle, deleteMessage, deletedMessage, Form,
}: Props<T>) {
  const toast = useToast();
  const state = useFetch<T[]>(fetcher, fetchKey);
  const [form, setForm] = useState<{ item: T | null } | null>(null);
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await api.delete(deletePath(toDelete));
      toast(deletedMessage);
      state.refresh();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <>
      <DataScreen state={state} header={header}>
        {(items) => (
          <>
            {toolbar}
            <View style={styles.top}>
              <Text style={styles.count}>{countLabel(items.length)}</Text>
              <Button title={addLabel} icon="add" small onPress={() => setForm({ item: null })} />
            </View>
            {items.length === 0 ? (
              <EmptyState {...empty} />
            ) : (
              items.map((item) => {
                const row = renderRow(item);
                return (
                  <Card key={keyOf(item)} style={styles.card}>
                    <View style={styles.text}>
                      <Text style={styles.title} numberOfLines={1}>{row.title}</Text>
                      {row.lines.map((line, index) => (
                        <Text key={index} style={styles.line} numberOfLines={1}>{line}</Text>
                      ))}
                      {row.badges && <View style={styles.badges}>{row.badges}</View>}
                    </View>
                    <View style={styles.actions}>
                      {(!canEdit || canEdit(item)) && (
                        <IconButton icon="create-outline" label="Modifier" color={colors.primary}
                          onPress={() => setForm({ item })} />
                      )}
                      <IconButton icon="trash-outline" label="Supprimer" color={colors.danger}
                        onPress={() => setToDelete(item)} />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </DataScreen>

      {form && (
        <Form
          item={form.item}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            toast(message);
            state.refresh();
          }}
        />
      )}

      <ConfirmDialog
        visible={toDelete !== null}
        title={deleteTitle}
        message={toDelete ? deleteMessage(toDelete) : ''}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        destructive
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function IconButton({ icon, label, color, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  count: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  text: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  line: { fontSize: fontSize.sm, color: colors.textSecondary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row' },
  iconButton: {
    width: touchSize - 4, height: touchSize - 4, borderRadius: (touchSize - 4) / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.surfaceMuted },
});
