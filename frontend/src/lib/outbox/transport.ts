/** Transport interface the outbox drains through (the test seam). */

import type { OutboxItem } from './types';

export interface UploadCallbacks {
  onProgress?: (fraction: number) => void;
  /** Persist the TUS resume URL as soon as the server assigns one. */
  onUploadUrl?: (url: string) => void;
}

export interface TransportResult {
  /** URL of the created content object. */
  remoteUrl: string;
}

export class TransportError extends Error {
  constructor(
    message: string,
    /** Permanent errors (4xx) are not retried automatically. */
    public permanent = false
  ) {
    super(message);
  }
}

export interface OutboxTransport {
  /** Create a Note via plain REST. */
  createNote(item: OutboxItem): Promise<TransportResult>;

  /**
   * Upload a media item via TUS (resumable). When `item.uploadUrl` is set,
   * the transport must resume the existing upload instead of restarting.
   */
  uploadMedia(item: OutboxItem, callbacks: UploadCallbacks): Promise<TransportResult>;
}
