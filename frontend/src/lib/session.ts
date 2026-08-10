/**
 * App-wide session: one ApiClient instance + reactive auth state.
 */

import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { writable } from 'svelte/store';

import { ApiClient, localTokenStorage, memoryTokenStorage } from './api/client';

export const api = new ApiClient({
  tokenStorage: browser ? localTokenStorage() : memoryTokenStorage(),
  onAuthExpired: () => {
    authenticated.set(false);
    if (browser) goto('/login');
  }
});

export const authenticated = writable(browser ? api.authenticated : false);

export async function login(user: string, password: string): Promise<void> {
  await api.login(user, password);
  authenticated.set(true);
}

export async function logout(): Promise<void> {
  await api.logout();
  authenticated.set(false);
  if (browser) goto('/login');
}

/** Renew the token on app start so a whole trip fits one login. */
export function keepSessionFresh(): void {
  if (!browser || !api.authenticated) return;
  api.ensureFreshToken().catch(() => {
    /* offline is fine — the token is checked again when online */
  });
}
