/**
 * PROTOTYPE — throwaway. Ticket 07 of the immich-import map.
 *
 * Runs with no backend: the root layout only shows the top bar and bottom
 * nav (the chrome these variants have to live inside) when `authenticated`
 * is true, so seed a throwaway token when there isn't a real one. An
 * existing real session is never touched, and nothing on this route calls
 * the API.
 */
import { authenticated } from '$lib/session';

export const ssr = false;
export const prerender = false;

export function load() {
  const KEY = 'travelstream.token';
  if (!localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, 'PROTOTYPE-ONLY-FAKE-TOKEN');
  }
  authenticated.set(true);
  return {};
}
