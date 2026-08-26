/**
 * Stage a picked or shared media file into the outbox: persisted before
 * anything else happens, so a killed app loses nothing. Shared between
 * /capture (file pickers) and /capture/share (Android share sheet).
 */

import { outbox } from '$lib/outbox';
import { currentPosition, extractPhotoMetadata } from './exif';
import type { CaptureKind } from '$lib/outbox/types';

export interface StageOptions {
  /**
   * Fill in the device's current GPS position when the file has none.
   * Right for in-the-moment capture; wrong for files shared in from
   * another app, which were usually taken elsewhere — and the permission
   * prompt would ambush someone who only tapped "share".
   */
  attachPosition: boolean;
}

export async function stageMediaFile(
  kind: CaptureKind,
  tripPath: string,
  file: File,
  { attachPosition }: StageOptions
): Promise<void> {
  // EXIF is a fast local read; keep it. GPS can take seconds - the
  // item is committed first, position attached when it arrives.
  const metadata = kind === 'photo' ? await extractPhotoMetadata(file) : {};
  // Gallery picks often happen days after the moment: without EXIF
  // (videos, stripped photos) the file's own mtime is the honest
  // capture time, not "now".
  if (!metadata.capturedAt && file.lastModified) {
    metadata.capturedAt = new Date(file.lastModified).toISOString();
  }
  const item = await outbox.enqueue({
    kind,
    tripPath,
    staged: true,
    title: file.name.replace(/\.[^.]+$/, ''),
    blob: file,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    ...metadata
  });
  if (attachPosition && item.latitude === undefined) {
    void currentPosition()
      .then((position) => outbox.amendPosition(item.id, position))
      .catch(() => {});
  }
}
