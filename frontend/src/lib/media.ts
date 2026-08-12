/**
 * uid -> media URL cache for editor embeds.
 *
 * Documents store uid-only references (resolveuid semantics), but
 * `resolveuid/...` URLs are unusable from the PWA: under the `/++api++/`
 * proxy the backend answers them with a redirect to the un-prefixed
 * content path, which nginx resolves to the SPA's index.html. So the
 * editor renders embeds from the real Plone scale URLs instead — the
 * same `image_scales` data the timeline already delivers.
 *
 * The cache is primed for free whenever timeline items pass by (picker,
 * insert) and persisted to localStorage so reopening an article does not
 * refetch metadata for every embed. Misses (e.g. an old article on a new
 * device) are resolved with one authenticated `@search?UID=` request.
 * Hashed scale URLs are content-addressed; when an image is replaced the
 * old URL 404s, so consumers can `refresh()` to bypass the cache once.
 */

import { api } from '$lib/session';
import { browseUrl } from '$lib/format';
import type { ImageFieldScales, TimelineItem } from '$lib/api/types';

export interface MediaUrls {
  /** Proxy-relative scale URLs by scale name (teaser, large, ...). */
  scales: Record<string, string>;
  /** Original image download (fallback when a scale is missing). */
  image: string | null;
  /** Video file download URL (File objects only). */
  video: string | null;
}

const STORAGE_KEY = 'travelstream.media.v1';

type CacheEntry = MediaUrls;

let cache: Map<string, CacheEntry> | null = null;
const pending = new Map<string, Promise<MediaUrls | null>>();

function load(): Map<string, CacheEntry> {
  if (cache) return cache;
  cache = new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      for (const [uid, entry] of Object.entries(JSON.parse(raw))) {
        cache.set(uid, entry as CacheEntry);
      }
    }
  } catch {
    /* corrupt or unavailable storage: start empty */
  }
  return cache;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(load())));
  } catch {
    /* storage full or unavailable: cache stays in-memory */
  }
}

interface ScaledItem {
  '@id': string;
  '@type'?: string;
  image_scales?: Record<string, ImageFieldScales[]> | null;
}

function entryFromItem(item: ScaledItem): CacheEntry {
  const base = browseUrl(item['@id']);
  const scales: Record<string, string> = {};
  let image: string | null = null;
  for (const fieldScales of Object.values(item.image_scales ?? {})) {
    const field = fieldScales?.[0];
    if (!field) continue;
    image = `${base}/${field.download}`;
    for (const [name, scale] of Object.entries(field.scales ?? {})) {
      scales[name] = `${base}/${scale.download}`;
    }
    break;
  }
  // @@display-media, not @@download: attachment disposition suppresses
  // inline playback UI in Firefox.
  const video = item['@type'] === 'File' ? `${base}/@@display-media/file` : null;
  return { scales, image, video };
}

/** Seed the cache from timeline items already at hand (no requests). */
export function primeMediaCache(items: TimelineItem[]): void {
  if (items.length === 0) return;
  const store = load();
  for (const item of items) {
    if (item.UID) store.set(item.UID, entryFromItem(item));
  }
  persist();
}

/** Cached URLs for a uid, or undefined (no request). */
export function cachedMedia(uid: string): MediaUrls | undefined {
  return load().get(uid);
}

/**
 * URLs for a uid, fetching metadata once on a miss. `refresh` bypasses
 * the cache (stale hashed URLs after an image was replaced). Returns
 * null when the object is gone or not visible.
 */
export function resolveMedia(uid: string, refresh = false): Promise<MediaUrls | null> {
  if (!refresh) {
    const hit = load().get(uid);
    if (hit) return Promise.resolve(hit);
  }
  const inflight = pending.get(uid);
  if (inflight && !refresh) return inflight;
  const request = api
    .get<{ items: ScaledItem[] }>(
      `/@search?UID=${uid}&metadata_fields=image_scales&b_size=1`
    )
    .then((result) => {
      const item = result.items[0];
      if (!item) return null;
      const entry = entryFromItem(item);
      load().set(uid, entry);
      persist();
      return entry;
    })
    .catch(() => null)
    .finally(() => pending.delete(uid));
  pending.set(uid, request);
  return request;
}

/** First available scale URL from a preference list. */
export function pickScale(media: MediaUrls, preference: string[]): string | null {
  for (const name of preference) {
    const url = media.scales[name];
    if (url) return url;
  }
  return media.image;
}
