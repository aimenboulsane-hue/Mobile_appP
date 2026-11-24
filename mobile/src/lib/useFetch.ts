import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from './api';

export type FetchState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  refresh: () => void;
  setData: (data: T) => void;
};

export function useFetch<T>(fetcher: () => Promise<T>, key: string = ''): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const callId = useRef(0);

  const run = useCallback(async (mode: 'load' | 'refresh' | 'silent') => {
    const id = ++callId.current;
    if (mode === 'load') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (id !== callId.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (id !== callId.current) return;
      if (mode !== 'silent') setError(errorMessage(e));
    } finally {
      if (id === callId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    run('load');
  }, [run, key]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      run('silent');
    }, [run]),
  );

  return {
    data,
    loading,
    refreshing,
    error,
    reload: useCallback(() => run('load'), [run]),
    refresh: useCallback(() => run('refresh'), [run]),
    setData,
  };
}
