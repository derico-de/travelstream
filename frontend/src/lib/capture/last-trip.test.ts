import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearLastTrip, recallLastTrip, rememberLastTrip } from './last-trip';

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  });
});

describe('last trip selection', () => {
  it('keeps the selected trip until it is explicitly cleared', () => {
    rememberLastTrip('trips/alps');
    expect(recallLastTrip()).toBe('trips/alps');

    clearLastTrip();
    expect(recallLastTrip()).toBe('');
  });
});
