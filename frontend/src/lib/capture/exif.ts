/** Client-side EXIF extraction (exifr) + Geolocation API fallback. */

import exifr from 'exifr';

export interface CaptureMetadata {
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
}

export async function extractPhotoMetadata(file: Blob): Promise<CaptureMetadata> {
  try {
    const data = await exifr.parse(file as File, {
      pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude']
    });
    if (!data) return {};
    const timestamp: Date | undefined = data.DateTimeOriginal ?? data.CreateDate;
    return {
      capturedAt: timestamp ? timestamp.toISOString() : undefined,
      latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
      longitude: typeof data.longitude === 'number' ? data.longitude : undefined
    };
  } catch {
    return {};
  }
}

/** One-shot device position, or nothing when denied/unavailable. */
export function currentPosition(timeoutMs = 8000): Promise<CaptureMetadata> {
  if (!('geolocation' in navigator)) return Promise.resolve({});
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
      () => resolve({}),
      { timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}
