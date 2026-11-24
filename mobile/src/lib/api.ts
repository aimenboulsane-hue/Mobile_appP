import { API_URL, REQUEST_TIMEOUT_MS } from '@/config';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const tokenSent = authToken;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(tokenSent ? { Authorization: `Bearer ${tokenSent}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0);
  } finally {
    clearTimeout(timer);
  }

  const data: any = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && tokenSent) {
      onSessionExpired?.();
      throw new ApiError('Session expirée. Veuillez vous reconnecter.', 401);
    }
    throw new ApiError(data?.error || 'Une erreur est survenue. Veuillez réessayer.', response.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
}
