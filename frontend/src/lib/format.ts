/** Small formatting/URL helpers shared by the UI. */

import { API_BASE } from './api/base';
import type { ImageFieldScales, ImagePayload, TimelineItem, Trip } from './api/types';

/** Path of a content object relative to the site root, from its @id. */
export function contentPath(atId: string): string {
  try {
    const url = new URL(atId);
    const segments = url.pathname.split('/').filter((s) => s && s !== '++api++');
    // Direct backend access (dev proxy) puts the site id first
    // (/Plone/trips/...); behind the deploy's virtual-host rewrite the
    // site root is already stripped (/trips/...). All PWA content lives
    // under the trips folder, so a different first segment is a site id.
    if (segments[0] && segments[0] !== 'trips') segments.shift();
    return segments.join('/');
  } catch {
    return atId.replace(/^\//, '');
  }
}

/**
 * Browse URL for a backend content URL, rebased onto the API we are
 * configured to talk to (same-origin proxy by default, another origin when
 * the backend is deployed separately).
 */
export function browseUrl(atId: string): string {
  if (!/^https?:\/\//.test(atId)) return atId;
  return `${API_BASE}/${contentPath(atId)}`;
}

/** Cover (lead image) URL of any content with a plone.leadimage field. */
export function coverUrl(content: {
  '@id': string;
  image?: ImageFieldScales | null;
}): string | null {
  const image = content.image;
  if (!image) return null;
  const scale = image.scales?.preview ?? image.scales?.teaser;
  const download = scale?.download ?? image.download;
  if (!download) return null;
  return download.startsWith('http')
    ? browseUrl(download)
    : `${browseUrl(content['@id'])}/${download}`;
}

export function tripCoverUrl(trip: Trip): string | null {
  return coverUrl(trip);
}

/** Read a picked file into the base64 payload plone.restapi expects. */
export async function readImagePayload(file: File): Promise<ImagePayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return {
    data: dataUrl.split(',', 2)[1] ?? '',
    encoding: 'base64',
    filename: file.name,
    'content-type': file.type || 'application/octet-stream'
  };
}

function itemScaleUrl(item: TimelineItem, preference: string[]): string | null {
  for (const fieldScales of Object.values(item.image_scales ?? {})) {
    const entry = fieldScales?.[0];
    if (!entry) continue;
    const scale = preference
      .map((name) => entry.scales?.[name])
      .find((candidate) => candidate !== undefined);
    const download = scale?.download ?? entry.download;
    if (download) return `${browseUrl(item['@id'])}/${download}`;
  }
  return null;
}

export function itemThumbnail(item: TimelineItem): string | null {
  return itemScaleUrl(item, ['teaser', 'preview', 'thumb']);
}

/** Wide card cover for list views (articles tab). */
export function itemCover(item: TimelineItem): string | null {
  return itemScaleUrl(item, ['preview', 'teaser', 'large']);
}

export function itemFullImage(item: TimelineItem): string | null {
  return itemScaleUrl(item, ['larger', 'large', 'preview']);
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export function formatDate(value: string | null): string {
  if (!value) return '';
  return dateFormat.format(new Date(value));
}

export function formatCaptureTime(value: string): string {
  return timeFormat.format(new Date(value));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** ISO datetime -> local-time value for an <input type="datetime-local">. */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

/** <input type="datetime-local"> value -> UTC ISO string; undefined when empty/invalid. */
export function fromDatetimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return formatDate(start ?? end);
}

/** Is today inside the trip's date range? (Used to pick the active trip.) */
export function tripIsActive(trip: Trip, today = new Date()): boolean {
  if (!trip.start_date || !trip.end_date) return false;
  const start = new Date(trip.start_date);
  const end = new Date(trip.end_date);
  end.setHours(23, 59, 59, 999);
  return today >= start && today <= end;
}
