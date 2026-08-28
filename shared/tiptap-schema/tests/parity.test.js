/**
 * Renderer parity: the same golden ProseMirror fixtures must render
 * equivalently through TipTap's generateHTML (this suite) and the Python
 * renderer (backend functional suite). A schema change that breaks parity
 * fails both.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderToHTML } from '../src/render.js';
import { normalizeHTML } from './normalize.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'prosemirror-fixtures'
);

// `unknown-node` is Python-only: TipTap's strict schema cannot produce
// unknown nodes, so that fixture pins the *server's* defensive fallback
// for documents written by future schema versions. `media-text-no-uid`
// pins the server's fallback for a uid-less block, which the editor never
// produces (matching travelImage, the JS side does not guard uid).
const PYTHON_ONLY = new Set(['unknown-node', 'media-text-no-uid']);

const names = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((name) => !PYTHON_ONLY.has(name));

describe('golden fixture parity (TipTap side)', () => {
  it('finds the shared fixtures', () => {
    expect(names.length).toBeGreaterThanOrEqual(3);
  });

  for (const name of names) {
    it(`renders ${name} equivalently to the pinned HTML`, () => {
      const doc = JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf8'));
      const expected = readFileSync(join(fixturesDir, `${name}.html`), 'utf8').trim();
      const actual = renderToHTML(doc);
      expect(normalizeHTML(actual)).toBe(normalizeHTML(expected));
    });
  }
});
