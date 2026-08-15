/** Outbox domain types. */

export type CaptureKind = 'photo' | 'video' | 'note';

export type OutboxState = 'staged' | 'captured' | 'queued' | 'uploading' | 'done' | 'failed';

/** kind -> Plone @type mapping, applied at drain time. */
export const TYPE_FOR_KIND: Record<CaptureKind, string> = {
  photo: 'Image',
  video: 'File',
  note: 'Note'
};

export interface OutboxItem {
  id: string;
  kind: CaptureKind;
  state: OutboxState;
  /**
   * Site-relative path of the Trip the item is filed under. Empty string
   * means captured without a trip: the item is held locally (never
   * drained) until a trip is assigned in the Outbox.
   */
  tripPath: string;
  title: string;
  /** Optional caption delivered as the Plone Description field. */
  description?: string;
  /** Plone keywords (subjects) applied at drain time. */
  tags?: string[];
  /** Note body (kind === 'note' only). */
  text?: string;
  /** Media payload (photo/video); persisted in IndexedDB alongside. */
  blob?: Blob;
  filename?: string;
  contentType?: string;
  /** iOS camera-roll reference fallback: item waits for its file. */
  pendingAttachment?: boolean;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  /** 0..1 while uploading. */
  progress: number;
  error?: string;
  attempts: number;
  /** Epoch ms before which automatic drain skips this failed item. */
  nextAttemptAt?: number;
  /** TUS resume URL — survives restarts so uploads continue, not restart. */
  uploadUrl?: string;
  /** URL of the created content once done. */
  remoteUrl?: string;
  createdAt: number;
}

export interface CaptureInput {
  kind: CaptureKind;
  tripPath: string;
  title: string;
  description?: string;
  tags?: string[];
  /**
   * Staged items are persisted immediately (a picked file must never be
   * lost) but held from drain while their details are still being reviewed;
   * releaseStaged() queues them.
   */
  staged?: boolean;
  text?: string;
  blob?: Blob;
  filename?: string;
  contentType?: string;
  pendingAttachment?: boolean;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
}
