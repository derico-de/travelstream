import { describe, expect, it } from 'vitest';

import { browseUrl, contentPath, fromDatetimeLocal, toDatetimeLocal } from './format';

describe('contentPath', () => {
  it('strips the site id when accessing the backend directly (dev proxy)', () => {
    expect(contentPath('http://localhost:8080/Plone/trips/transfagarasan-2026')).toBe(
      'trips/transfagarasan-2026'
    );
  });

  it('keeps the full path behind the virtual-host rewrite (deploy)', () => {
    // nginx's VirtualHostRoot already removed the /Plone segment; dropping
    // another segment here caused @tus-upload 404s (trips/ went missing).
    expect(contentPath('http://powerman:8085/trips/transfagarasan-2026')).toBe(
      'trips/transfagarasan-2026'
    );
  });

  it('drops ++api++ markers anywhere in the path', () => {
    expect(contentPath('http://powerman:8085/++api++/trips/x')).toBe('trips/x');
    expect(contentPath('http://localhost:8080/Plone/++api++/trips/x')).toBe('trips/x');
  });

  it('resolves items nested inside a trip', () => {
    expect(contentPath('http://powerman:8085/trips/x/img-001')).toBe('trips/x/img-001');
    expect(contentPath('http://localhost:8080/Plone/trips/x/img-001')).toBe('trips/x/img-001');
  });

  it('passes through non-URL values without a leading slash', () => {
    expect(contentPath('/trips/x')).toBe('trips/x');
  });
});

describe('datetime-local conversion', () => {
  it('round-trips a local wall-clock time through ISO and back', () => {
    const local = '2026-08-09T14:30';
    expect(toDatetimeLocal(fromDatetimeLocal(local))).toBe(local);
  });

  it('renders an ISO instant in local time with zero-padded fields', () => {
    const iso = new Date(2026, 0, 5, 7, 5).toISOString();
    expect(toDatetimeLocal(iso)).toBe('2026-01-05T07:05');
  });

  it('maps empty and invalid values to safe defaults', () => {
    expect(toDatetimeLocal(null)).toBe('');
    expect(toDatetimeLocal(undefined)).toBe('');
    expect(toDatetimeLocal('not a date')).toBe('');
    expect(fromDatetimeLocal('')).toBeUndefined();
    expect(fromDatetimeLocal('not a date')).toBeUndefined();
  });
});

describe('browseUrl', () => {
  it('builds a proxy-relative URL from a deploy @id', () => {
    expect(browseUrl('http://powerman:8085/trips/x/@@images/img.png')).toBe(
      '/++api++/trips/x/@@images/img.png'
    );
  });

  it('builds a proxy-relative URL from a direct-backend @id', () => {
    expect(browseUrl('http://localhost:8080/Plone/trips/x/@@images/img.png')).toBe(
      '/++api++/trips/x/@@images/img.png'
    );
  });

  it('returns non-URL values unchanged', () => {
    expect(browseUrl('@@images/img.png')).toBe('@@images/img.png');
  });
});
