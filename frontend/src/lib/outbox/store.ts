/** Outbox persistence interface + in-memory implementation (tests). */

import type { OutboxItem } from './types';

export interface OutboxStore {
  add(item: OutboxItem): Promise<void>;
  update(id: string, patch: Partial<OutboxItem>): Promise<void>;
  get(id: string): Promise<OutboxItem | undefined>;
  /** All items, ordered by createdAt ascending (capture order). */
  list(): Promise<OutboxItem[]>;
  delete(id: string): Promise<void>;
}

export class MemoryOutboxStore implements OutboxStore {
  private items = new Map<string, OutboxItem>();

  async add(item: OutboxItem): Promise<void> {
    this.items.set(item.id, { ...item });
  }

  async update(id: string, patch: Partial<OutboxItem>): Promise<void> {
    const existing = this.items.get(id);
    if (!existing) return;
    this.items.set(id, { ...existing, ...patch });
  }

  async get(id: string): Promise<OutboxItem | undefined> {
    const item = this.items.get(id);
    return item ? { ...item } : undefined;
  }

  async list(): Promise<OutboxItem[]> {
    return [...this.items.values()]
      .map((item) => ({ ...item }))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
