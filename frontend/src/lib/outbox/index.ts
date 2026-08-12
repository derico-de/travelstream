/**
 * Browser wiring for the outbox: Dexie persistence, TUS transport, drain
 * on reconnect/app start, and a Svelte store view of the queue.
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

import { api } from '../session';
import { DexieOutboxStore } from './dexie-store';
import { Outbox } from './outbox';
import { MemoryOutboxStore } from './store';
import { TusTransport } from './tus-transport';
import type { OutboxItem } from './types';

export const outboxItems = writable<OutboxItem[]>([]);

/** Browser connectivity, kept current by the online/offline events. */
export const online = writable(true);

function createOutbox(): Outbox {
  const store = browser ? new DexieOutboxStore() : new MemoryOutboxStore();
  const outbox = new Outbox({
    store,
    transport: new TusTransport(api),
    onChange: () => {
      void outbox.list().then((items) => outboxItems.set(items));
    }
  });
  return outbox;
}

export const outbox = createOutbox();

export function startOutboxDraining(): void {
  if (!browser) return;
  void outbox.list().then((items) => outboxItems.set(items));
  online.set(navigator.onLine);
  if (navigator.onLine) void outbox.drain();
  window.addEventListener('online', () => {
    online.set(true);
    void outbox.drain();
  });
  window.addEventListener('offline', () => {
    online.set(false);
  });
  // Periodic nudge so backoff retries happen without user interaction.
  setInterval(() => {
    if (navigator.onLine) void outbox.drain();
  }, 30_000);
}
