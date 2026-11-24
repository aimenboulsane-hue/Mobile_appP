import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, fontWeight, radius, shadow, spacing } from '@/theme';

type ToastTone = 'success' | 'danger';
type ToastMessage = { text: string; tone: ToastTone };

const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => {});

const VISIBLE_MS = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, tone: ToastTone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, tone });
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View style={[styles.wrapper, { top: insets.top + spacing.sm }]}>
          <View
            accessibilityRole="alert"
            style={[styles.toast, { backgroundColor: toast.tone === 'success' ? colors.success : colors.danger }]}>
            <Ionicons
              name={toast.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={colors.onPrimary}
            />
            <Text style={styles.text}>{toast.text}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    maxWidth: 480,
    ...shadow,
  },
  text: { flexShrink: 1, color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
