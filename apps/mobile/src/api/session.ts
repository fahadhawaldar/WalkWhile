import * as SecureStore from 'expo-secure-store';
import { AuthSession, AuthUser } from '@walkwhile/shared';
import { API_BASE_URL } from './client';

// The refresh token lives in the iOS Keychain; the short-lived access token
// only in memory.
const REFRESH_TOKEN_KEY = 'walkwhile.refreshToken';
// Renew the access token a little before it actually expires.
const EXPIRY_MARGIN_MS = 60_000;

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let user: AuthUser | null = null;
let pending: Promise<string> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.error?.message ?? `Request failed (${response.status})`, response.status);
  }
  return (await response.json()) as T;
}

async function adopt(session: AuthSession): Promise<string> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
  accessToken = session.accessToken;
  accessTokenExpiresAt = Date.now() + session.expiresIn * 1000;
  user = session.user;
  return session.accessToken;
}

async function startSession(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (refreshToken) {
    try {
      return await adopt(await postJson<AuthSession>('/api/v1/auth/refresh', { refreshToken }));
    } catch (err) {
      // Only a rejected token means starting over; a network error should
      // not throw away the account.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
  }
  // First launch (or the old session is gone): a fresh anonymous account.
  return adopt(await postJson<AuthSession>('/api/v1/auth/anonymous'));
}

/** A valid access token, creating an anonymous account on first use. */
export function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && accessToken && Date.now() < accessTokenExpiresAt - EXPIRY_MARGIN_MS) {
    return Promise.resolve(accessToken);
  }
  // One request at a time, so parallel calls don't each rotate the token.
  pending ??= startSession().finally(() => {
    pending = null;
  });
  return pending;
}

export function getCurrentUser(): AuthUser | null {
  return user;
}

/** fetch() against the API as the signed-in user, retrying once on 401. */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = async (token: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let response = await send(await getAccessToken());
  if (response.status === 401) {
    response = await send(await getAccessToken(true));
  }
  return response;
}

/**
 * Upgrades the current (anonymous) account with an Apple or Google login.
 * Walks already saved stay with the account.
 */
export async function linkIdentity(provider: 'apple' | 'google', idToken: string): Promise<AuthUser> {
  const response = await authedFetch('/api/v1/auth/link', {
    method: 'POST',
    body: JSON.stringify({ provider, idToken }),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data?.error?.message ?? 'Sign-in failed', response.status);
  await adopt(data as AuthSession);
  return (data as AuthSession).user;
}
