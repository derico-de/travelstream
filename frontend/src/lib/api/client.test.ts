/** API client: auth + request behavior against a fake fetch. */

import { describe, expect, it } from 'vitest';

import { ApiClient, ApiError, memoryTokenStorage } from './client';

// exp far in the future / past (unsigned test JWTs — only the payload matters)
function fakeJwt(expSecondsFromNow: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() / 1000 + expSecondsFromNow })
  ).toString('base64');
  return `x.${payload}.y`;
}

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(handler: (url: string, init: RequestInit) => Response | object) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const result = handler(url, init);
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe('ApiClient auth', () => {
  it('logs in and sends the bearer token on later requests', async () => {
    const token = fakeJwt(3600 * 24 * 7);
    const { fetchFn, calls } = fakeFetch((url) => {
      if (url.endsWith('/@login')) return { token };
      return { items: [] };
    });
    const api = new ApiClient({ fetchFn, tokenStorage: memoryTokenStorage() });

    await api.login('alice', 'secret');
    expect(api.authenticated).toBe(true);

    await api.get('/@search?portal_type=Trip');
    const headers = calls[1].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('renews the token once on 401 and retries the request', async () => {
    const oldToken = fakeJwt(60);
    const newToken = fakeJwt(3600 * 24 * 7);
    let renewed = false;
    const { fetchFn, calls } = fakeFetch((url, init) => {
      if (url.endsWith('/@login-renew')) {
        renewed = true;
        return { token: newToken };
      }
      const headers = init.headers as Record<string, string>;
      if (headers.Authorization === `Bearer ${oldToken}`) {
        return new Response('{}', { status: 401 });
      }
      return { ok: true };
    });
    const api = new ApiClient({ fetchFn, tokenStorage: memoryTokenStorage() });
    api.tokens.set(oldToken);

    const result = await api.get<{ ok: boolean }>('/something');
    expect(renewed).toBe(true);
    expect(result.ok).toBe(true);
    expect(api.tokens.get()).toBe(newToken);
    expect(calls.length).toBe(3); // original, renew, retry
  });

  it('drops the token and signals expiry when renewal fails', async () => {
    let expired = false;
    const { fetchFn } = fakeFetch((url) => {
      return new Response('{}', { status: 401 });
    });
    const api = new ApiClient({
      fetchFn,
      tokenStorage: memoryTokenStorage(),
      onAuthExpired: () => (expired = true)
    });
    api.tokens.set(fakeJwt(60));

    await expect(api.get('/anything')).rejects.toThrow(ApiError);
    expect(expired).toBe(true);
    expect(api.tokens.get()).toBeNull();
  });

  it('creates a Trip in the trips container', async () => {
    const { fetchFn, calls } = fakeFetch(() => ({
      '@id': 'http://backend:8080/Plone/trips/alps',
      '@type': 'Trip',
      title: 'Alps'
    }));
    const api = new ApiClient({ fetchFn, tokenStorage: memoryTokenStorage() });

    const trip = await api.createTrip({ title: 'Alps', start_date: '2026-08-01' });
    expect(calls[0].url).toBe('/++api++/trips');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      '@type': 'Trip',
      title: 'Alps',
      start_date: '2026-08-01'
    });
    expect(trip.title).toBe('Alps');
  });

  it('resolves backend absolute URLs through the same-origin proxy', () => {
    const api = new ApiClient({ baseUrl: '/++api++' });
    expect(api.resolve('http://backend:8080/plone/trips/alps/@travel-timeline')).toBe(
      '/++api++/plone/trips/alps/@travel-timeline'
    );
    expect(api.resolve('/@login')).toBe('/++api++/@login');
  });

  it('caches settings for offline seeding (last fetch wins, absent is null)', async () => {
    // Node has no localStorage; the client treats it as best-effort.
    const backing = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k)
    };
    try {
      const { fetchFn } = fakeFetch(() => ({
        article_type: 'Document',
        can_add_keywords: true
      }));
      const api = new ApiClient({ fetchFn, tokenStorage: memoryTokenStorage() });
      expect(api.settingsCached()).toBeNull();

      await api.settings();
      expect(api.settingsCached()?.can_add_keywords).toBe(true);

      // A fresh client (new page load, offline) still sees the cache.
      const offline = new ApiClient({ tokenStorage: memoryTokenStorage() });
      expect(offline.settingsCached()?.can_add_keywords).toBe(true);
    } finally {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  it('keeps the query string of batch links (b_start would be lost)', () => {
    const api = new ApiClient({ baseUrl: '/++api++' });
    expect(
      api.resolve('http://backend:8080/plone/trips/alps/@travel-timeline?b_size=25&b_start=25')
    ).toBe('/++api++/plone/trips/alps/@travel-timeline?b_size=25&b_start=25');
    // Virtual-host rewritten URLs already carry the proxy prefix.
    expect(
      api.resolve('https://site.example/++api++/trips/alps/@travel-timeline?b_start=25')
    ).toBe('/++api++/trips/alps/@travel-timeline?b_start=25');
  });

  describe('separately deployed backend (absolute base)', () => {
    const base = 'https://travel.planetcrazy.de/++api++';

    it('sends relative paths to the configured backend origin', () => {
      const api = new ApiClient({ baseUrl: base });
      expect(api.resolve('/@login')).toBe(`${base}/@login`);
      expect(api.resolve('trips')).toBe(`${base}/trips`);
    });

    it('does not double the base path on URLs the backend hands back', () => {
      // The killer case: a TUS Location, or any @id, already carries
      // /++api++. Prefixing the whole absolute base would produce
      // .../++api++/++api++/... and every upload resume would 404.
      const api = new ApiClient({ baseUrl: base });
      expect(api.resolve(`${base}/trips/alps/@tus-upload/abc123`)).toBe(
        `${base}/trips/alps/@tus-upload/abc123`
      );
      expect(api.resolve('/++api++/trips/alps/@travel-timeline?b_start=25')).toBe(
        `${base}/trips/alps/@travel-timeline?b_start=25`
      );
    });

    it('rebases URLs the backend claims for some other host', () => {
      // Plone builds Locations from its own virtual-host view; if that is
      // misconfigured the app must still talk to the backend we chose.
      const api = new ApiClient({ baseUrl: base });
      expect(api.resolve('http://backend:8080/++api++/trips/alps')).toBe(
        `${base}/trips/alps`
      );
    });

    it('trims a trailing slash so URLs never contain //', () => {
      const api = new ApiClient({ baseUrl: `${base}/` });
      expect(api.resolve('/trips')).toBe(`${base}/trips`);
    });
  });
});
