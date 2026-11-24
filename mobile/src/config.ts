import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const CURRENCY = 'DA';

const API_PORT = 5000;

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const devServer = Constants.expoConfig?.hostUri;
  const host = devServer?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl().replace(/\/+$/, '');

export const REQUEST_TIMEOUT_MS = 10000;
