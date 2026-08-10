/**
 * Offline map regions (ticket 18): downloadable PMTiles bundles stored in
 * IndexedDB, used by MapLibre in the field; online tiles when connected.
 */

import Dexie, { type EntityTable } from 'dexie';

export interface MapBundle {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  blob: Blob;
  downloadedAt: number;
}

class MapBundleDatabase extends Dexie {
  bundles!: EntityTable<MapBundle, 'id'>;

  constructor() {
    super('travelstream-map-bundles');
    this.version(1).stores({ bundles: 'id, name' });
  }
}

const db = new MapBundleDatabase();

export async function listBundles(): Promise<Omit<MapBundle, 'blob'>[]> {
  const bundles = await db.bundles.toArray();
  return bundles.map(({ blob, ...rest }) => rest);
}

export async function getBundleBlob(id: string): Promise<Blob | null> {
  const bundle = await db.bundles.get(id);
  return bundle?.blob ?? null;
}

export async function firstBundleBlob(): Promise<Blob | null> {
  const bundle = (await db.bundles.toArray())[0];
  return bundle?.blob ?? null;
}

export async function deleteBundle(id: string): Promise<void> {
  await db.bundles.delete(id);
}

/** Download a .pmtiles region bundle with progress reporting. */
export async function downloadBundle(
  url: string,
  name: string,
  onProgress?: (fraction: number, receivedBytes: number) => void
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status})`);
  }
  const total = Number(response.headers.get('Content-Length') ?? 0);
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(total ? received / total : 0, received);
  }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  await db.bundles.put({
    id: crypto.randomUUID(),
    name,
    url,
    sizeBytes: blob.size,
    blob,
    downloadedAt: Date.now()
  });
}
