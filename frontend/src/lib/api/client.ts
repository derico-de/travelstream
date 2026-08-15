/**
 * Thin hand-written typed client for the Plone REST API endpoints the PWA
 * uses: login/refresh, CRUD, TUS, timeline, geojson, publish, settings.
 *
 * The client is constructed with a `fetch` implementation and a token
 * store so it stays testable without a browser.
 */

import { API_BASE, apiBasePath } from './base';
import type {
  GeojsonResponse,
  LoginResponse,
  NewTrip,
  PublishResponse,
  TimelineFilters,
  TimelineResponse,
  TravelstreamSettings,
  Trip,
  VocabularyResponse
} from './types';

export interface TokenStorage {
  get(): string | null;
  set(token: string | null): void;
}

const SETTINGS_CACHE_KEY = 'travelstream.settings';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string
  ) {
    super(message ?? `API error ${status}`);
  }
}

export interface ApiClientOptions {
  /**
   * Base URL of the REST API. Either a path on the app's own origin
   * (`/++api++`, the default) or an absolute URL when the backend is
   * deployed separately (`https://travel.example/++api++`).
   */
  baseUrl?: string;
  fetchFn?: typeof fetch;
  tokenStorage?: TokenStorage;
  /** Called when a request fails with 401 after a refresh attempt. */
  onAuthExpired?: () => void;
}

export function memoryTokenStorage(): TokenStorage {
  let token: string | null = null;
  return {
    get: () => token,
    set: (value) => {
      token = value;
    }
  };
}

export function localTokenStorage(key = 'travelstream.token'): TokenStorage {
  return {
    get: () => localStorage.getItem(key),
    set: (value) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64url = token.split('.')[1] ?? '';
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string, withinSeconds = 60 * 60 * 24): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp - Date.now() / 1000 < withinSeconds;
}

export class ApiClient {
  baseUrl: string;
  /** Path part of `baseUrl`, the bit a backend URL may already carry. */
  private basePath: string;
  private fetchFn: typeof fetch;
  tokens: TokenStorage;
  private onAuthExpired?: () => void;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? API_BASE).replace(/\/+$/, '');
    this.basePath = apiBasePath(this.baseUrl);
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.tokens = options.tokenStorage ?? memoryTokenStorage();
    this.onAuthExpired = options.onAuthExpired;
  }

  get authenticated(): boolean {
    return this.tokens.get() !== null;
  }

  /** Resolve a path or absolute content URL against the API base. */
  resolve(pathOrUrl: string): string {
    if (/^https?:\/\//.test(pathOrUrl)) {
      // Absolute content URL from the backend: keep path and query (batch
      // links carry b_start there) and re-attach our own base, so the
      // request goes where we point the app rather than wherever the
      // backend thinks it lives. TUS Locations depend on this.
      const url = new URL(pathOrUrl);
      pathOrUrl = `${url.pathname}${url.search}`;
    }
    if (!pathOrUrl.startsWith('/')) pathOrUrl = `/${pathOrUrl}`;
    // Virtual-host rewritten URLs come back already carrying the base
    // path; appending it again would yield /++api++/++api++/... Compare
    // against the *path*, not the whole base — with an absolute base
    // (separately deployed backend) the two never match as strings.
    if (pathOrUrl === this.basePath) pathOrUrl = '';
    else if (this.basePath && pathOrUrl.startsWith(`${this.basePath}/`)) {
      pathOrUrl = pathOrUrl.slice(this.basePath.length);
    }
    return `${this.baseUrl}${pathOrUrl}`;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryOn401 = true
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.tokens.get();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await this.fetchFn(this.resolve(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (response.status === 401 && token && retryOn401) {
      const renewed = await this.tryRenew();
      if (renewed) return this.request<T>(method, path, body, false);
      this.tokens.set(null);
      this.onAuthExpired?.();
    }
    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.json();
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(response.status, errorBody);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // -- auth ---------------------------------------------------------------

  async login(login: string, password: string): Promise<void> {
    const result = await this.request<LoginResponse>(
      'POST',
      '/@login',
      { login, password },
      false
    );
    this.tokens.set(result.token);
  }

  async logout(): Promise<void> {
    try {
      await this.request('POST', '/@logout', {}, false);
    } catch {
      /* token may already be invalid; drop it regardless */
    }
    this.tokens.set(null);
  }

  /** Renew the JWT if it is close to expiry. Returns true when usable. */
  async tryRenew(): Promise<boolean> {
    const token = this.tokens.get();
    if (!token) return false;
    try {
      const result = await this.request<LoginResponse>(
        'POST',
        '/@login-renew',
        {},
        false
      );
      this.tokens.set(result.token);
      return true;
    } catch {
      return false;
    }
  }

  /** Renew proactively when the stored token is near expiry. */
  async ensureFreshToken(): Promise<void> {
    const token = this.tokens.get();
    if (token && isTokenExpiringSoon(token)) {
      await this.tryRenew();
    }
  }

  // -- travelstream surface ------------------------------------------------

  async listTrips(): Promise<Trip[]> {
    const result = await this.get<{ items: Trip[] }>(
      '/@search?portal_type=Trip&sort_on=sortable_title&fullobjects=1'
    );
    return result.items;
  }

  getTrip(tripUrl: string): Promise<Trip> {
    return this.get<Trip>(tripUrl);
  }

  /** Create a Trip in the household trips container. */
  createTrip(data: NewTrip): Promise<Trip> {
    return this.post<Trip>('/trips', { '@type': 'Trip', ...data });
  }

  timeline(containerUrl: string, filters: TimelineFilters = {}): Promise<TimelineResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
      else params.set(key, String(value));
    }
    const qs = params.toString();
    return this.get<TimelineResponse>(
      `${containerUrl}/@travel-timeline${qs ? `?${qs}` : ''}`
    );
  }

  timelinePage(batchUrl: string): Promise<TimelineResponse> {
    return this.get<TimelineResponse>(batchUrl);
  }

  geojson(containerUrl: string, filters: TimelineFilters = {}): Promise<GeojsonResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
      else params.set(key, String(value));
    }
    const qs = params.toString();
    return this.get<GeojsonResponse>(
      `${containerUrl}/@travel-geojson${qs ? `?${qs}` : ''}`
    );
  }

  async settings(): Promise<TravelstreamSettings> {
    const result = await this.get<TravelstreamSettings>('/@travelstream-settings');
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(result));
    } catch {
      /* cache is best-effort */
    }
    return result;
  }

  /**
   * Last successfully fetched settings, surviving restarts and offline.
   * Seed UI state from this so a failed fetch (flaky Wi-Fi, backend down)
   * degrades to yesterday's truth instead of a wrong hardcoded default.
   */
  settingsCached(): TravelstreamSettings | null {
    try {
      const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as TravelstreamSettings) : null;
    } catch {
      return null;
    }
  }

  /** All existing keywords (tags) on the site. */
  async keywords(): Promise<string[]> {
    const result = await this.get<VocabularyResponse>(
      '/@vocabularies/plone.app.vocabularies.Keywords?b_size=1000'
    );
    return result.items.map((term) => term.title);
  }

  publish(articleUrl: string, transition: 'publish' | 'retract' = 'publish'): Promise<PublishResponse> {
    return this.post<PublishResponse>(`${articleUrl}/@travel-publish`, { transition });
  }

  /** Authorization header value for non-fetch transports (TUS uploads). */
  authHeaders(): Record<string, string> {
    const token = this.tokens.get();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Userid from the JWT (its `sub` claim), or null. */
  currentUserId(): string | null {
    const token = this.tokens.get();
    if (!token) return null;
    const sub = decodeJwtPayload(token)?.sub;
    return typeof sub === 'string' ? sub : null;
  }
}
