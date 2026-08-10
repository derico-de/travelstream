/** Outbox domain types. */

export type CaptureKind = 'photo' | 'video' | 'note';

export type OutboxState = 'captured' | 'queued' | 'uploading' | 'done' | 'failed';

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
  /** Site-relative path of the Trip the item is filed under. */
  tripPath: string;
  title: string;
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
  text?: string;
  blob?: Blob;
  filename?: string;
  contentType?: string;
  pendingAttachment?: boolean;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
}
