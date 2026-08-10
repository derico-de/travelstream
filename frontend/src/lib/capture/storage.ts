/**
 * Storage honesty layer (ticket 17): iOS quietly evicts IndexedDB/OPFS
 * data under pressure, so the PWA asks for persistent storage, surfaces
 * the risk before large captures, and offers the camera-roll-reference
 * fallback instead of promising durable local video storage.
 */

export interface StorageStatus {
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  /** Rough share of quota used, 0..1 (0 when quota unknown). */
  usageRatio: number;
  /** True when a large video capture is risky on this device. */
  evictionRisk: boolean;
  isIOS: boolean;
  standalone: boolean;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  );
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function storageStatus(): Promise<StorageStatus> {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const estimate = (await navigator.storage?.estimate?.()) ?? {};
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  const ratio = quota > 0 ? usage / quota : 0;
  const ios = isIOS();
  return {
    persisted,
    usageBytes: usage,
    quotaBytes: quota,
    usageRatio: ratio,
    // iOS without persistence is always at risk; anywhere else warn when
    // storage is filling up or the quota is tiny (< 200 MB free).
    evictionRisk:
      (ios && !persisted) ||
      ratio > 0.8 ||
      (quota > 0 && quota - usage < 200 * 1024 * 1024),
    isIOS: ios,
    standalone: isStandalone()
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(1)} GB`;
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}
