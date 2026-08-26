/**
 * Hand-off between the service worker and /capture/share: the Android
 * share sheet delivers files as a POST that only the worker sees, so it
 * stashes them here and redirects; the page takes them and stages them
 * into the outbox. Raw IndexedDB, not Dexie — this module is bundled into
 * the service worker (src/sw.ts), which must stay framework-free.
 */

const DB_NAME = 'travelstream-share';
const STORE = 'incoming';

interface StashedFile {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Append shared files. Appending (never replacing) means two shares in
 * quick succession — before the page got a chance to run — both survive.
 * Name/type/mtime are stored as plain fields and re-applied on take, so
 * nothing depends on how faithfully the browser clones File metadata.
 */
export async function stashSharedFiles(files: readonly File[]): Promise<void> {
  if (files.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    for (const file of files) {
      tx.objectStore(STORE).add({
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        blob: file
      } satisfies StashedFile);
    }
    await done(tx);
  } finally {
    db.close();
  }
}

/** Take (read + delete) everything stashed, oldest first. */
export async function takeSharedFiles(): Promise<File[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const read = new Promise<StashedFile[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as StashedFile[]);
      request.onerror = () => reject(request.error);
    });
    store.clear();
    const stashed = await read;
    await done(tx);
    return stashed.map(
      (f) =>
        new File([f.blob], f.name || 'shared', {
          type: f.type || f.blob.type,
          lastModified: f.lastModified
        })
    );
  } finally {
    db.close();
  }
}
