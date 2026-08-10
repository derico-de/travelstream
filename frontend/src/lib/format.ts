/** Small formatting/URL helpers shared by the UI. */

import type { TimelineItem, Trip } from './api/types';

/** Path of a content object relative to the site root, from its @id. */
export function contentPath(atId: string): string {
  try {
    const url = new URL(atId);
    // Strip a leading /<site-id> segment plus the /++api++ marker if present.
    return url.pathname
      .replace(/^\/\+\+api\+\+/, '')
      .replace(/^\//, '')
      .split('/')
      .slice(1)
      .join('/');
  } catch {
    return atId.replace(/^\//, '');
  }
}

/** Proxy-relative browse URL for a backend content URL. */
export function browseUrl(atId: string): string {
  try {
    const url = new URL(atId);
    return `/++api++${url.pathname.replace(/^\/\+\+api\+\+/, '')}`;
  } catch {
    return atId;
  }
}

export function tripCoverUrl(trip: Trip): string | null {
  const image = trip.image;
  if (!image) return null;
  const scale = image.scales?.preview ?? image.scales?.teaser;
  const download = scale?.download ?? image.download;
  if (!download) return null;
  return download.startsWith('http') ? browseUrl(download) : `${browseUrl(trip['@id'])}/${download}`;
}

export function itemThumbnail(item: TimelineItem): string | null {
  for (const fieldScales of Object.values(item.image_scales ?? {})) {
    const entry = fieldScales?.[0];
    if (!entry) continue;
    const scale = entry.scales?.teaser ?? entry.scales?.preview ?? entry.scales?.thumb;
    const download = scale?.download ?? entry.download;
    if (download) return `${browseUrl(item['@id'])}/${download}`;
  }
  return null;
}

export function itemFullImage(item: TimelineItem): string | null {
  for (const fieldScales of Object.values(item.image_scales ?? {})) {
    const entry = fieldScales?.[0];
    if (!entry) continue;
    const scale = entry.scales?.larger ?? entry.scales?.large ?? entry.scales?.preview;
    const download = scale?.download ?? entry.download;
    if (download) return `${browseUrl(item['@id'])}/${download}`;
  }
  return null;
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
