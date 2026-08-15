/** Where the API lives: build-time default, runtime override, path split. */

import { describe, expect, it } from 'vitest';

import { apiBasePath, resolveApiBase } from './base';

describe('resolveApiBase', () => {
  it('falls back to the built-in base', () => {
    expect(resolveApiBase(null, '/++api++')).toBe('/++api++');
  });

  it('lets a stored override point the app at another backend', () => {
    expect(resolveApiBase('https://other.example/++api++', '/++api++')).toBe(
      'https://other.example/++api++'
    );
  });

  it('ignores a blank override rather than pointing at nothing', () => {
    expect(resolveApiBase('   ', '/++api++')).toBe('/++api++');
    expect(resolveApiBase('', 'https://travel.example/++api++')).toBe(
      'https://travel.example/++api++'
    );
  });

  it('trims trailing slashes so joins never produce //', () => {
    expect(resolveApiBase(null, 'https://travel.example/++api++//')).toBe(
      'https://travel.example/++api++'
    );
  });
});

describe('apiBasePath', () => {
  it('is the base itself when the API is same-origin', () => {
    expect(apiBasePath('/++api++')).toBe('/++api++');
  });

  it('is the path part of an absolute base', () => {
    expect(apiBasePath('https://travel.example/++api++')).toBe('/++api++');
  });

  it('is empty for a bare origin, so nothing is stripped twice', () => {
    expect(apiBasePath('https://travel.example')).toBe('');
  });
});
