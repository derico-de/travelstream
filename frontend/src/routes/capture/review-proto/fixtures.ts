/**
 * PROTOTYPE — throwaway. Ticket 07 of the immich-import map.
 *
 * Fake share-in batch: real Blobs behind real object URLs, so the grid is
 * exercised against real decodes rather than against coloured <div>s.
 *
 * Round 2 (after the 2026-08-18 verdict): a share is reviewed a page at a
 * time — ~30 items — even when the share itself is large. So a batch models
 * three different numbers, and they are not the same thing:
 *
 *   share    — files the share sheet delivered
 *   imported — how many have finished resizing (arrival is progressive)
 *   items    — the page currently under review (<= pageSize)
 *
 * Videos are *held*, not refused: video import is a later step, but the app
 * does accept videos, so calling them "skipped" would be a lie.
 *
 * Deterministic: same seed → same batch, so variants compare side by side.
 */

export interface ProtoItem {
  id: string;
  filename: string;
  /** null models a stripped "share preview" (ticket 09, part 2). */
  capturedAt: Date | null;
  hasGps: boolean;
  /** Derivative dimensions — what the outbox actually holds (ticket 05). */
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  url: string;
  /** filename of the earlier item this one may repeat (ticket 11). */
  duplicateOf: string | null;
  title: string;
  description: string;
  tags: string[];
  discarded: boolean;
}

export interface ProtoSkipped {
  filename: string;
  reason: string;
}

export interface ProtoBatch {
  /** The page under review. */
  items: ProtoItem[];
  /** Truly undecodable — nothing downstream can use these. */
  skipped: ProtoSkipped[];
  /** Accepted, held for the video-import step. Not an error. */
  videosWaiting: string[];
  pageSize: number;
  share: number;
  imported: number;
  tripTitle: string;
}

/** mulberry32 — small, seedable, good enough for fixture noise. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Paint something photo-shaped. Bigger than round 1 (1024px) because the
 * winning variant shows far larger previews now that a page is ~30.
 */
async function fakePhoto(
  rand: () => number,
  index: number,
  portrait: boolean,
  small: boolean
): Promise<{ blob: Blob; width: number; height: number }> {
  const long = small ? 400 : 1024;
  const short = Math.round(long * 0.75);
  const width = portrait ? short : long;
  const height = portrait ? long : short;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  const hue = Math.floor(rand() * 360);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, `hsl(${hue} 45% ${62 + rand() * 18}%)`);
  sky.addColorStop(1, `hsl(${(hue + 25) % 360} 35% ${38 + rand() * 16}%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const horizon = height * (0.5 + rand() * 0.25);
  ctx.fillStyle = `hsl(${(hue + 180) % 360} 22% ${22 + rand() * 14}%)`;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += width / 6) {
    ctx.lineTo(x, horizon - rand() * height * 0.16);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `hsl(${Math.floor(rand() * 360)} 60% 70%)`;
    ctx.beginPath();
    ctx.arc(rand() * width, rand() * horizon, 14 + rand() * 60, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, height - 44, 92, 44);
  ctx.fillStyle = 'white';
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillText(String(index + 1).padStart(3, '0'), 12, height - 14);

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return { blob, width, height };
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * @param pageSize  how many are reviewed at once
 * @param share     how many files the share delivered
 * @param imported  how many have finished resizing
 */
export async function buildBatch(
  pageSize: number,
  share: number,
  imported: number,
  onProgress: (done: number) => void
): Promise<ProtoBatch> {
  const rand = rng(0x7ea9);
  const items: ProtoItem[] = [];
  const onPage = Math.max(0, Math.min(pageSize, imported, share));

  // A week of a real trip, with bursts: three frames four seconds apart is
  // exactly the case an EXIF-timestamp dedup heuristic gets wrong.
  let clock = new Date('2026-09-18T08:12:00').getTime();

  // Deterministically chosen oddities, scaled to the page.
  const pick = (n: number) => {
    const out = new Set<number>();
    let guard = 0;
    while (out.size < Math.min(n, onPage) && guard++ < 500) out.add(Math.floor(rand() * onPage));
    return out;
  };
  const noGps = pick(Math.max(1, Math.round(onPage * 0.17)));
  const stripped = pick(1);
  const dupes = pick(2);

  for (let i = 0; i < onPage; i++) {
    const burst = rand() < 0.28;
    clock += burst ? 3500 + rand() * 2500 : 60_000 + rand() * (DAY / 9);
    const isStripped = stripped.has(i);
    const portrait = rand() < 0.32;
    const { blob, width, height } = await fakePhoto(rand, i, portrait, isStripped);

    // Immich v3 names remote-only assets uniquely on every share (ticket 01).
    const remote = rand() < 0.4;
    const base = `IMG_${4600 + i}`;
    const filename = remote
      ? `share-original-${(0x1000 + i).toString(16)}-${Math.floor(rand() * 1e6)}-${base}.JPG`
      : `${base}.JPG`;

    const originalLong = isStripped ? 1600 : rand() < 0.25 ? 6000 : 4032;
    const originalShort = Math.round(originalLong * 0.75);

    items.push({
      id: `p${i}`,
      filename,
      capturedAt: isStripped ? null : new Date(clock),
      hasGps: !isStripped && !noGps.has(i),
      width,
      height,
      originalWidth: portrait ? originalShort : originalLong,
      originalHeight: portrait ? originalLong : originalShort,
      originalBytes: isStripped
        ? 620_000
        : originalLong === 6000
          ? 21_000_000 + Math.floor(rand() * 6_000_000)
          : 3_400_000 + Math.floor(rand() * 2_000_000),
      url: URL.createObjectURL(blob),
      duplicateOf: null,
      title: base,
      description: '',
      tags: [],
      discarded: false
    });
    onProgress(i + 1);
  }

  for (const n of dupes) {
    const item = items[n];
    if (item && n > 0) item.duplicateOf = items[n - 1]?.filename ?? null;
  }

  return {
    items,
    // Accepted, not refused — video import is a later step (2026-08-18).
    videosWaiting: ['VID_20260921_141133.mp4', 'VID_20260922_090412.mp4'],
    // The genuinely unusable case: nothing in this browser can decode it.
    skipped: [{ filename: 'IMG_4711.HEIC', reason: 'HEIC — this browser cannot decode it' }],
    pageSize,
    share,
    imported: Math.min(imported, share),
    tripTitle: 'Transfăgărășan 2026'
  };
}

export function releaseBatch(batch: ProtoBatch | null): void {
  for (const item of batch?.items ?? []) URL.revokeObjectURL(item.url);
}

export const fmtDate = (d: Date | null): string =>
  d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—';

export const fmtTime = (d: Date | null): string =>
  d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'no date';

export function fmtRange(items: ProtoItem[]): string {
  const dates = items.map((i) => i.capturedAt).filter((d): d is Date => !!d);
  if (!dates.length) return '—';
  const lo = new Date(Math.min(...dates.map((d) => d.getTime())));
  const hi = new Date(Math.max(...dates.map((d) => d.getTime())));
  return `${fmtDate(lo)} – ${fmtDate(hi)}`;
}

export function fmtBytes(n: number): string {
  if (n > 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n > 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.round(n / 1e3)} kB`;
}

export const SUGGESTED_TAGS = [
  'romania',
  'mountains',
  'roadtrip',
  'food',
  'hiking',
  'sunset',
  'carpathians'
];
