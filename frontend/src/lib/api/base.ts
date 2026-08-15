/**
 * Where the Plone REST API lives.
 *
 * The default is `/++api++` on the app's own origin: the reverse proxy in
 * `deploy/` mounts plone.restapi there, which keeps the browser out of CORS
 * entirely and lets the service worker treat backend media as first-party.
 *
 * A build can instead point at a backend on another origin:
 *
 *     VITE_API_BASE=https://travel.planetcrazy.de/++api++ pnpm build
 *
 * and `localStorage['travelstream.apiBase']` overrides that again at
 * runtime, which is what lets one hosted build talk to a different Plone
 * site without rebuilding. Both are read once at module load — changing
 * either needs a reload.
 *
 * Everything that builds a backend URL goes through here (ApiClient's
 * default base, `browseUrl()` in format.ts), so nothing else needs to know
 * whether the backend is same-origin or not. See deploy/CADDY.md for what
 * the split topology costs.
 */

const OVERRIDE_KEY = 'travelstream.apiBase';

/** Pure core of the resolution, kept separate so it is testable. */
export function resolveApiBase(override: string | null, builtIn: string): string {
  return (override?.trim() || builtIn).replace(/\/+$/, '');
}

function readOverride(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(OVERRIDE_KEY);
  } catch {
    // Storage blocked (private mode, third-party cookie rules): the
    // built-in base is still perfectly usable.
    return null;
  }
}

/** Origin-and-path prefix of every REST call, without a trailing slash. */
export const API_BASE = resolveApiBase(
  readOverride(),
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/++api++'
);

/** The path part of {@link API_BASE} (`''` when the base is bare origin). */
export function apiBasePath(base = API_BASE): string {
  if (!/^https?:\/\//.test(base)) return base;
  const path = new URL(base).pathname.replace(/\/+$/, '');
  return path === '/' ? '' : path;
}

/** True only when the API really is on another origin than the app. */
export function isCrossOrigin(base = API_BASE): boolean {
  if (!/^https?:\/\//.test(base)) return false;
  try {
    return new URL(base).origin !== location.origin;
  } catch {
    // No `location` (SSR/prerender of the shell): an absolute base was
    // configured deliberately, so assume it is remote.
    return true;
  }
}

/**
 * `crossorigin` attribute for backend media. Cross-origin `<img>` without
 * it yields an opaque response, which the service worker's image cache
 * cannot store — so offline photos would silently stop working. With it,
 * the backend must send `Access-Control-Allow-Origin` on `/++api++` (the
 * split deployment needs that for the JSON API anyway).
 */
export const MEDIA_CROSSORIGIN: 'anonymous' | undefined = isCrossOrigin()
  ? 'anonymous'
  : undefined;
