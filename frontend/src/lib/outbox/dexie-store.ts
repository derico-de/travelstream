/** Dexie/IndexedDB-backed outbox store: captures survive app restarts. */

import Dexie, { type EntityTable } from 'dexie';

import type { OutboxStore } from './store';
import type { OutboxItem } from './types';

class OutboxDatabase extends Dexie {
  items!: EntityTable<OutboxItem, 'id'>;

  constructor(name = 'travelstream-outbox') {
    super(name);
    this.version(1).stores({
      // Blobs are stored inline in the record (IndexedDB handles Blob values).
      items: 'id, state, createdAt'
    });
  }
}

export class DexieOutboxStore implements OutboxStore {
  private db: OutboxDatabase;

  constructor(databaseName?: string) {
    this.db = new OutboxDatabase(databaseName);
  }

  async add(item: OutboxItem): Promise<void> {
    await this.db.items.put(item);
  }

  async update(id: string, patch: Partial<OutboxItem>): Promise<void> {
    await this.db.items.update(id, patch);
  }

  async get(id: string): Promise<OutboxItem | undefined> {
    return this.db.items.get(id);
  }

  async list(): Promise<OutboxItem[]> {
    return this.db.items.orderBy('createdAt').toArray();
  }

  async delete(id: string): Promise<void> {
    await this.db.items.delete(id);
  }
}
