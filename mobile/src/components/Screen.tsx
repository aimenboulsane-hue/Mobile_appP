import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { FetchState } from '@/lib/useFetch';
import { colors, spacing } from '@/theme';

import { ErrorState, LoadingState, Notice } from './States';

type ScreenProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({ header, footer, children, scroll = true, refreshing = false, onRefresh }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {header}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                colors={[colors.primary]} tintColor={colors.primary} />
            ) : undefined}>
            {children}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{children}</View>
        )}
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type DataScreenProps<T> = Omit<ScreenProps, 'children' | 'refreshing' | 'onRefresh'> & {
  state: FetchState<T>;
  children: (data: T) => React.ReactNode;
};

export function DataScreen<T>({ state, children, ...screenProps }: DataScreenProps<T>) {
  if (state.data === null) {
    return (
      <Screen {...screenProps} footer={undefined} scroll={false}>
        {state.loading
          ? <LoadingState />
          : <ErrorState message={state.error ?? 'Une erreur est survenue.'} onRetry={state.reload} />}
      </Screen>
    );
  }
  return (
    <Screen {...screenProps} refreshing={state.refreshing} onRefresh={state.refresh}>
      {state.error && screenProps.scroll !== false && <Notice message={state.error} />}
      {children(state.data)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.lg },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
