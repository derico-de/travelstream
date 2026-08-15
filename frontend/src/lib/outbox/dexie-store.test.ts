/**
 * Regression: review-screen edits arrive as framework-reactive Proxy
 * arrays. Real IndexedDB structured-clones records and throws
 * DataCloneError on Proxies — the Memory store used elsewhere doesn't, so
 * this suite runs the Dexie store against fake-indexeddb's real cloning.
 */

import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { DexieOutboxStore } from './dexie-store';
import { Outbox } from './outbox';
import type { OutboxTransport } from './transport';

const nullTransport: OutboxTransport = {
  createNote: () => Promise.reject(new Error('offline')),
  uploadMedia: () => Promise.reject(new Error('offline'))
};

/** Behaves like a Svelte 5 $state array reaching the outbox unspread. */
const proxied = (values: string[]) => new Proxy(values, {});

describe('DexieOutboxStore structured cloning', () => {
  it('accepts Proxy tag arrays via enqueue and amendDetails', async () => {
    const outbox = new Outbox({
      store: new DexieOutboxStore(`test-${Date.now()}`),
      transport: nullTransport
    });

    const item = await outbox.enqueue({
      kind: 'photo',
      tripPath: 'trips/alps',
      title: 'p',
      staged: true,
      tags: proxied(['passes'])
    });
    await outbox.amendDetails(item.id, {
      title: 'Passo Gardena',
      tags: proxied(['passes', 'dolomites'])
    });

    const [stored] = await outbox.list();
    expect(stored.title).toBe('Passo Gardena');
    expect(stored.tags).toEqual(['passes', 'dolomites']);
  });
});
