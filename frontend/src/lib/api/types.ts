/**
 * Types for the Plone REST API surface the PWA actually uses.
 * Hand-written on purpose — no OpenAPI generation in v1.
 */

export type EntryKind = 'photo' | 'video' | 'note' | 'article';

export interface ImageScale {
  download: string;
  width: number;
  height: number;
}

export interface ImageFieldScales {
  'content-type': string;
  download: string;
  filename: string;
  width: number;
  height: number;
  scales: Record<string, ImageScale>;
}

/** Item shape returned by @travel-timeline (summary + travel extras). */
export interface TimelineItem {
  '@id': string;
  '@type': string;
  title: string;
  description: string;
  review_state: string | null;
  kind: EntryKind | null;
  captured_at: string;
  latitude: number | null;
  longitude: number | null;
  image_scales: Record<string, ImageFieldScales[]>;
}

export interface TimelineResponse {
  '@id': string;
  items_total: number;
  items: TimelineItem[];
  batching?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface TimelineFilters {
  kind?: EntryKind | EntryKind[];
  captured_after?: string;
  captured_before?: string;
  bbox?: string;
  b_start?: number;
  b_size?: number;
}

export interface GeojsonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    '@id': string;
    uid: string;
    title: string;
    kind: EntryKind | null;
    captured_at: string;
    thumbnail: string | null;
  };
}

export interface GeojsonResponse {
  type: 'FeatureCollection';
  features: GeojsonFeature[];
}

export interface Trip {
  '@id': string;
  '@type': 'Trip';
  UID: string;
  id: string;
  title: string;
  description: string;
  review_state: string | null;
  start_date: string | null;
  end_date: string | null;
  image?: ImageFieldScales | null;
}

export interface ContentSummary {
  '@id': string;
  '@type': string;
  UID?: string;
  title: string;
  description?: string;
  review_state?: string | null;
}

export interface PublishResultItem {
  '@id': string;
  uid: string;
  title: string;
  status: 'done' | 'unchanged' | 'error';
  review_state: string | null;
  message?: string;
}

export interface PublishResponse {
  transition: 'publish' | 'retract';
  all_done: boolean;
  items: PublishResultItem[];
}

export interface TravelstreamSettings {
  article_type: string;
}

export interface LoginResponse {
  token: string;
}
