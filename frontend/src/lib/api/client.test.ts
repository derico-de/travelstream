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
});
