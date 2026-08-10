/**
 * Ticket 06: the outbox state machine against a fake transport.
 * Covers: enqueue offline, drain on reconnect, resume after interruption,
 * retry/backoff, manual retry/delete, ordering, kind -> @type mapping.
 */

import { describe, expect, it } from 'vitest';

import { Outbox } from './outbox';
import { MemoryOutboxStore } from './store';
import {
  TransportError,
  type OutboxTransport,
  type TransportResult,
  type UploadCallbacks
} from './transport';
import { TYPE_FOR_KIND, type OutboxItem } from './types';

interface UploadRecord {
  id: string;
  kind: string;
  type: string;
  resumedFrom?: string;
}

class FakeTransport implements OutboxTransport {
  uploads: UploadRecord[] = [];
  /** Map item title -> behavior. */
  failures = new Map<string, { times: number; permanent?: boolean }>();
  /** Interrupt after assigning an upload URL (simulates dropped Wi-Fi). */
  interruptOnce = new Set<string>();

  private maybeFail(item: OutboxItem): void {
    const failure = this.failures.get(item.title);
    if (failure && failure.times > 0) {
      failure.times -= 1;
      throw new TransportError(`boom: ${item.title}`, failure.permanent);
    }
  }

  async createNote(item: OutboxItem): Promise<TransportResult> {
    this.maybeFail(item);
    this.uploads.push({ id: item.id, kind: item.kind, type: TYPE_FOR_KIND[item.kind] });
    return { remoteUrl: `http://plone/${item.tripPath}/${item.title}` };
  }

  async uploadMedia(item: OutboxItem, callbacks: UploadCallbacks): Promise<TransportResult> {
    callbacks.onUploadUrl?.(`http://plone/tus/${item.id}`);
    callbacks.onProgress?.(0.4);
    if (this.interruptOnce.has(item.title)) {
      this.interruptOnce.delete(item.title);
      throw new TransportError('connection lost');
    }
    this.maybeFail(item);
    callbacks.onProgress?.(1);
    this.uploads.push({
      id: item.id,
      kind: item.kind,
      type: TYPE_FOR_KIND[item.kind],
      resumedFrom: item.uploadUrl
    });
    return { remoteUrl: `http://plone/${item.tripPath}/${item.title}` };
  }
}

function makeOutbox(overrides: { now?: () => number } = {}) {
  const store = new MemoryOutboxStore();
  const transport = new FakeTransport();
  let time = 1_000_000;
  const clock = {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    }
  };
  const outbox = new Outbox({
    store,
    transport,
    now: overrides.now ?? clock.now,
    backoffSchedule: [1_000, 5_000]
  });
  return { outbox, store, transport, clock };
}

const blob = () => new Blob(['bytes'], { type: 'image/jpeg' });

describe('outbox', () => {
  it('enqueues offline without touching the network and survives restarts', async () => {
    const { outbox, store, transport } = makeOutbox();
    await outbox.enqueue({
      kind: 'photo',
      tripPath: 'trips/alps',
      title: 'p1',
      blob: blob(),
      filename: 'p1.jpg',
      contentType: 'image/jpeg'
    });
    expect(transport.uploads).toHaveLength(0);

    // "Restart": a new Outbox over the same store still sees the item.
    const reopened = new Outbox({ store, transport, now: () => 2_000_000 });
    const items = await reopened.list();
    expect(items).toHaveLength(1);
    expect(items[0].state).toBe('queued');
  });

  it('drains queued items on reconnect, in capture order', async () => {
    const { outbox, transport, clock } = makeOutbox();
    await outbox.enqueue({ kind: 'photo', tripPath: 't', title: 'a', blob: blob() });
    clock.advance(10);
    await outbox.enqueue({ kind: 'note', tripPath: 't', title: 'b', text: 'hi' });
    clock.advance(10);
    await outbox.enqueue({ kind: 'video', tripPath: 't', title: 'c', blob: blob() });

    await outbox.drain();

    expect(transport.uploads.map((u) => u.kind)).toEqual(['photo', 'note', 'video']);
    const items = await outbox.list();
    expect(items.every((i) => i.state === 'done')).toBe(true);
    expect(items.every((i) => i.remoteUrl)).toBe(true);
  });

  it('maps kind to the stock Plone types', async () => {
    const { outbox, transport } = makeOutbox();
    await outbox.enqueue({ kind: 'photo', tripPath: 't', title: 'p', blob: blob() });
    await outbox.enqueue({ kind: 'video', tripPath: 't', title: 'v', blob: blob() });
    await outbox.enqueue({ kind: 'note', tripPath: 't', title: 'n' });
    await outbox.drain();
    expect(transport.uploads.map((u) => u.type)).toEqual(['Image', 'File', 'Note']);
  });

  it('resumes an interrupted upload instead of restarting', async () => {
    const { outbox, transport, clock } = makeOutbox();
    await outbox.enqueue({ kind: 'video', tripPath: 't', title: 'big', blob: blob() });

    transport.interruptOnce.add('big');
    await outbox.drain();

    let [item] = await outbox.list();
    expect(item.state).toBe('failed');
    expect(item.uploadUrl).toBe(`http://plone/tus/${item.id}`);

    // Backoff elapses; next drain resumes from the stored upload URL.
    clock.advance(2_000);
    await outbox.drain();
    [item] = await outbox.list();
    expect(item.state).toBe('done');
    expect(transport.uploads[0].resumedFrom).toBe(`http://plone/tus/${item.id}`);
  });

  it('applies backoff and gives up automatic retries after the cap', async () => {
    const { outbox, transport, clock } = makeOutbox();
    const failing = { times: 99 };
    transport.failures.set('bad', failing);
    await outbox.enqueue({ kind: 'photo', tripPath: 't', title: 'bad', blob: blob() });

    await outbox.drain();
    let [item] = await outbox.list();
    expect(item.state).toBe('failed');
    expect(item.attempts).toBe(1);

    // Within backoff: drain must skip it.
    clock.advance(500);
    await outbox.drain();
    [item] = await outbox.list();
    expect(item.attempts).toBe(1);

    // Drain after each backoff until the auto-retry cap (5).
    for (let i = 0; i < 10; i += 1) {
      clock.advance(10_000);
      await outbox.drain();
    }
    [item] = await outbox.list();
    expect(item.attempts).toBe(5);
    expect(item.state).toBe('failed');
  });

  it('one bad item never blocks the queue', async () => {
    const { outbox, transport } = makeOutbox();
    transport.failures.set('corrupt', { times: 99, permanent: true });
    await outbox.enqueue({ kind: 'photo', tripPath: 't', title: 'corrupt', blob: blob() });
    await outbox.enqueue({ kind: 'photo', tripPath: 't', title: 'fine', blob: blob() });

    await outbox.drain();

    const items = await outbox.list();
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byTitle.corrupt.state).toBe('failed');
    expect(byTitle.fine.state).toBe('done');
  });

  it('permanent failures wait for manual retry; retry works', async () => {
    const { outbox, transport, clock } = makeOutbox();
    transport.failures.set('later', { times: 1, permanent: true });
    await outbox.enqueue({ kind: 'photo', tripPath: 't', title: 'later', blob: blob() });

    await outbox.drain();
    let [item] = await outbox.list();
    expect(item.state).toBe('failed');

    // Automatic drain never picks it up again, even much later.
    clock.advance(10_000_000);
    await outbox.drain();
    [item] = await outbox.list();
    expect(item.attempts).toBe(1);

    await outbox.retry(item.id);
    [item] = await outbox.list();
    expect(item.state).toBe('done');
  });

  it('manual delete removes a failed item', async () => {
    const { outbox, transport } = makeOutbox();
    transport.failures.set('junk', { times: 99, permanent: true });
    await outbox.enqueue({ kind: 'photo', tripPath: 't', title: 'junk', blob: blob() });
    await outbox.drain();
    const [item] = await outbox.list();
    await outbox.delete(item.id);
    expect(await outbox.list()).toHaveLength(0);
  });

  it('progress is reported per item while uploading', async () => {
    const { outbox, store } = makeOutbox();
    const item = await outbox.enqueue({
      kind: 'photo',
      tripPath: 't',
      title: 'p',
      blob: blob()
    });
    await outbox.drain();
    const finished = await store.get(item.id);
    expect(finished?.progress).toBe(1);
  });

  it('camera-roll-reference items wait until the file is attached (iOS)', async () => {
    const { outbox, transport } = makeOutbox();
    const item = await outbox.enqueue({
      kind: 'video',
      tripPath: 't',
      title: 'roll-ref',
      pendingAttachment: true
    });
    await outbox.drain();
    expect(transport.uploads).toHaveLength(0);
    let [stored] = await outbox.list();
    expect(stored.state).toBe('captured');

    await outbox.attachFile(item.id, blob(), 'clip.mov', 'video/quicktime');
    await outbox.drain();
    [stored] = await outbox.list();
    expect(stored.state).toBe('done');
  });
});
