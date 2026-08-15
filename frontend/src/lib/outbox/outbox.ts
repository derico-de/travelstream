/**
 * The outbox state machine: captured -> queued -> uploading -> done/failed.
 *
 * Pure module: persistence (OutboxStore) and network (OutboxTransport) are
 * injected, time is injectable, no browser APIs. Ordering guarantee: items
 * drain strictly in capture order; a failed item is skipped (with backoff),
 * never blocking the rest of the queue.
 */

import type { OutboxStore } from './store';
import { TransportError, type OutboxTransport } from './transport';
import type { CaptureInput, OutboxItem } from './types';

export interface OutboxOptions {
  store: OutboxStore;
  transport: OutboxTransport;
  now?: () => number;
  /** Backoff schedule in ms per attempt (last entry repeats). */
  backoffSchedule?: number[];
  /** After this many attempts, only manual retry continues. */
  maxAutoAttempts?: number;
  onChange?: () => void;
}

const DEFAULT_BACKOFF = [5_000, 30_000, 120_000, 600_000];

let counter = 0;

function nextId(now: number): string {
  counter += 1;
  return `${now.toString(36)}-${counter.toString(36)}`;
}

export class Outbox {
  private store: OutboxStore;
  private transport: OutboxTransport;
  private now: () => number;
  private backoffSchedule: number[];
  private maxAutoAttempts: number;
  private onChange?: () => void;
  private draining = false;

  constructor(options: OutboxOptions) {
    this.store = options.store;
    this.transport = options.transport;
    this.now = options.now ?? Date.now;
    this.backoffSchedule = options.backoffSchedule ?? DEFAULT_BACKOFF;
    this.maxAutoAttempts = options.maxAutoAttempts ?? 5;
    this.onChange = options.onChange;
  }

  private changed(): void {
    this.onChange?.();
  }

  /** Capture an item into the outbox. Never touches the network. */
  async enqueue(input: CaptureInput): Promise<OutboxItem> {
    const now = this.now();
    const item: OutboxItem = {
      id: nextId(now),
      kind: input.kind,
      state: input.staged ? 'staged' : input.pendingAttachment ? 'captured' : 'queued',
      tripPath: input.tripPath,
      title: input.title,
      description: input.description,
      // Copy: callers may hand in framework-reactive Proxy arrays, which
      // IndexedDB's structured clone rejects.
      tags: input.tags ? [...input.tags] : undefined,
      text: input.text,
      blob: input.blob,
      filename: input.filename,
      contentType: input.contentType,
      pendingAttachment: input.pendingAttachment,
      capturedAt: input.capturedAt ?? new Date(now).toISOString(),
      latitude: input.latitude,
      longitude: input.longitude,
      progress: 0,
      attempts: 0,
      createdAt: now
    };
    await this.store.add(item);
    this.changed();
    return item;
  }

  /** Attach the real file to a camera-roll-reference item (iOS fallback). */
  async attachFile(id: string, blob: Blob, filename: string, contentType: string): Promise<void> {
    const item = await this.store.get(id);
    if (!item || item.state === 'done') return;
    await this.store.update(id, {
      blob,
      filename,
      contentType,
      pendingAttachment: false,
      state: 'queued',
      error: undefined
    });
    this.changed();
  }

  async list(): Promise<OutboxItem[]> {
    return this.store.list();
  }

  /** Items awaiting drain right now (queued, or failed with elapsed backoff). */
  private drainable(item: OutboxItem, now: number): boolean {
    if (item.pendingAttachment) return false;
    // Captured without a trip: the item is safe locally and waits for
    // assignment (never lose a capture over a missing decision).
    if (!item.tripPath) return false;
    if (item.state === 'queued') return true;
    if (item.state === 'failed') {
      if (item.attempts >= this.maxAutoAttempts) return false;
      return (item.nextAttemptAt ?? 0) <= now;
    }
    return false;
  }

  /**
   * Drain the queue in capture order. Concurrency 1 keeps ordering
   * deterministic and is right for flaky hotel Wi-Fi. Returns when no
   * more items are drainable.
   */
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      // Loop so items enqueued mid-drain are picked up too.
      for (;;) {
        const now = this.now();
        const candidates = (await this.store.list()).filter((item) =>
          this.drainable(item, now)
        );
        if (candidates.length === 0) return;
        for (const item of candidates) {
          await this.uploadOne(item.id);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async uploadOne(id: string): Promise<void> {
    const item = await this.store.get(id);
    if (!item) return;
    await this.store.update(id, { state: 'uploading', error: undefined });
    this.changed();

    try {
      const result =
        item.kind === 'note'
          ? await this.transport.createNote(item)
          : await this.transport.uploadMedia(item, {
              onProgress: (fraction) => {
                void this.store.update(id, { progress: fraction });
                this.changed();
              },
              onUploadUrl: (url) => {
                void this.store.update(id, { uploadUrl: url });
              }
            });
      await this.store.update(id, {
        state: 'done',
        progress: 1,
        remoteUrl: result.remoteUrl,
        error: undefined,
        // The blob is delivered; free the local storage.
        blob: undefined
      });
    } catch (error) {
      const current = await this.store.get(id);
      const attempts = (current?.attempts ?? 0) + 1;
      const permanent = error instanceof TransportError && error.permanent;
      const backoff =
        this.backoffSchedule[
          Math.min(attempts - 1, this.backoffSchedule.length - 1)
        ];
      await this.store.update(id, {
        state: 'failed',
        attempts,
        error: error instanceof Error ? error.message : String(error),
        nextAttemptAt: permanent ? Number.MAX_SAFE_INTEGER : this.now() + backoff
      });
    }
    this.changed();
  }

  /**
   * Update review-time details on a staged item. Persisted per edit so a
   * killed app mid-review loses no typing, only focus.
   */
  async amendDetails(
    id: string,
    details: { title?: string; description?: string; tags?: string[] }
  ): Promise<void> {
    const item = await this.store.get(id);
    if (!item || item.state !== 'staged') return;
    await this.store.update(id, {
      ...details,
      // Copy: reactive Proxy arrays fail IndexedDB's structured clone.
      ...(details.tags && { tags: [...details.tags] })
    });
  }

  /** Release all staged items into the queue; the caller decides to drain. */
  async releaseStaged(): Promise<OutboxItem[]> {
    const staged = (await this.store.list()).filter((i) => i.state === 'staged');
    for (const item of staged) {
      await this.store.update(item.id, { state: 'queued' });
    }
    if (staged.length > 0) this.changed();
    return staged;
  }

  /** Discard every staged item (explicit user choice; blobs are freed). */
  async discardStaged(): Promise<void> {
    const staged = (await this.store.list()).filter((i) => i.state === 'staged');
    for (const item of staged) {
      await this.store.delete(item.id);
    }
    if (staged.length > 0) this.changed();
  }

  /** Assign a trip to an item captured without one; it becomes drainable. */
  async assignTrip(id: string, tripPath: string): Promise<void> {
    const item = await this.store.get(id);
    if (!item || item.state === 'done' || item.state === 'uploading' || !tripPath) return;
    await this.store.update(id, { tripPath, error: undefined });
    this.changed();
  }

  /**
   * Attach a late-arriving GPS position (capture enqueues instantly; the
   * position is fetched in the background). Skipped once the item is in
   * flight or delivered - best-effort, never blocking.
   */
  async amendPosition(id: string, position: { latitude?: number; longitude?: number }): Promise<void> {
    if (position.latitude === undefined || position.longitude === undefined) return;
    const item = await this.store.get(id);
    if (!item || item.state === 'done' || item.state === 'uploading') return;
    if (item.latitude !== undefined) return; // EXIF or an earlier fix wins
    await this.store.update(id, {
      latitude: position.latitude,
      longitude: position.longitude
    });
  }

  /** Manual retry: clears backoff and drains immediately. */
  async retry(id: string): Promise<void> {
    const item = await this.store.get(id);
    if (!item || item.state !== 'failed') return;
    await this.store.update(id, {
      state: 'queued',
      attempts: 0,
      nextAttemptAt: undefined,
      error: undefined
    });
    this.changed();
    await this.drain();
  }

  /** Manual delete: a corrupt file must never block the queue. */
  async delete(id: string): Promise<void> {
    await this.store.delete(id);
    this.changed();
  }

  /** Re-queue every failed item (including permanently parked ones) and drain. */
  async retryAll(): Promise<void> {
    const failed = (await this.store.list()).filter((i) => i.state === 'failed');
    if (failed.length === 0) return;
    for (const item of failed) {
      await this.store.update(item.id, {
        state: 'queued',
        attempts: 0,
        nextAttemptAt: undefined,
        error: undefined
      });
    }
    this.changed();
    await this.drain();
  }

  /** Remove finished items from the list; their content is on the server. */
  async clearDone(): Promise<void> {
    const done = (await this.store.list()).filter((i) => i.state === 'done');
    for (const item of done) {
      await this.store.delete(item.id);
    }
    if (done.length > 0) this.changed();
  }
}
