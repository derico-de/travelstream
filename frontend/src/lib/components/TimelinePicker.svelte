<script lang="ts">
  import { api } from '$lib/session';
  import { itemThumbnail } from '$lib/format';
  import { primeMediaCache } from '$lib/media';
  import type { TimelineItem } from '$lib/api/types';
  import type { GalleryItemRef, GalleryPlacement } from './gallery';

  /** Selection entry: what the gallery node stores, plus the capture time
      (client-side only) so "Sort by capture time" works. */
  type Selected = GalleryItemRef & { captured_at?: string };

  let {
    path,
    onclose,
    onpick,
    multiple = false,
    editing = false,
    initial = [],
    onconfirm
  }: {
    path: string;
    onclose: () => void;
    /** Single-embed mode: tap a tile to pick it (legacy 📷 Embed flow). */
    onpick?: (item: TimelineItem) => void;
    /** Multi-select gallery mode. */
    multiple?: boolean;
    /** Editing an existing gallery: pre-selects, hides placement. */
    editing?: boolean;
    initial?: GalleryItemRef[];
    onconfirm?: (items: GalleryItemRef[], placement: GalleryPlacement) => void;
  } = $props();

  let items = $state<TimelineItem[]>([]);
  let nextUrl = $state<string | null>(null);
  let loading = $state(false);
  let error = $state('');
  let sentinel = $state<HTMLElement | null>(null);
  let scroller = $state<HTMLElement | null>(null);

  // The picker is mounted fresh per open ({#if} in ArticleEditor), so
  // capturing `initial` once is the intended seeding, not a stale ref.
  // svelte-ignore state_referenced_locally
  let selected = $state<Selected[]>(initial.map((item) => ({ ...item })));
  let placement = $state<GalleryPlacement>('end');

  /** uid -> 1-based selection order, for the tile badges. */
  const badge = $derived(new Map(selected.map((entry, i) => [entry.uid, i + 1])));

  /** Fill capture times (and missing alts) for pre-selected uids as pages load. */
  function backfill(loaded: TimelineItem[]) {
    const byUid = new Map(loaded.map((item) => [item.UID, item]));
    for (const entry of selected) {
      const match = byUid.get(entry.uid);
      if (!match) continue;
      if (!entry.captured_at) entry.captured_at = match.captured_at;
      if (!entry.alt) entry.alt = match.title;
    }
  }

  async function loadFirstPage() {
    loading = true;
    error = '';
    try {
      const response = await api.timeline(`/${path}`, {
        kind: ['photo', 'video'],
        b_size: 50
      });
      items = response.items;
      nextUrl = response.batching?.next ?? null;
      backfill(response.items);
      primeMediaCache(response.items);
    } catch {
      error = 'Could not load the trip stream — you may be offline.';
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!nextUrl || loading) return;
    loading = true;
    try {
      const response = await api.timelinePage(nextUrl);
      // Same guard as Timeline: duplicates crash the keyed {#each}.
      const known = new Set(items.map((i) => i['@id']));
      items = [...items, ...response.items.filter((i) => !known.has(i['@id']))];
      nextUrl = response.batching?.next ?? null;
      backfill(response.items);
      primeMediaCache(response.items);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void path;
    loadFirstPage();
  });

  $effect(() => {
    if (!sentinel || !scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root: scroller }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  function toggle(item: TimelineItem) {
    const index = selected.findIndex((entry) => entry.uid === item.UID);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push({
        uid: item.UID,
        kind: item.kind === 'video' ? 'video' : 'photo',
        alt: item.title,
        captured_at: item.captured_at
      });
    }
  }

  /** Stable re-order by capture time; not-yet-loaded entries keep their
      relative order at the end. */
  function sortByCaptureTime() {
    selected = selected
      .map((entry, i) => ({ entry, i }))
      .sort((a, b) => {
        const ta = a.entry.captured_at;
        const tb = b.entry.captured_at;
        if (ta && tb) return ta < tb ? -1 : ta > tb ? 1 : a.i - b.i;
        if (ta) return -1;
        if (tb) return 1;
        return a.i - b.i;
      })
      .map(({ entry }) => entry);
  }

  function confirm() {
    onconfirm?.(
      selected.map(({ uid, kind, alt }) => ({ uid, kind, alt })),
      placement
    );
  }

  const title = $derived(
    multiple ? (editing ? 'Edit gallery' : 'Gallery from this trip') : 'Embed from this trip'
  );

  const confirmLabel = $derived.by(() => {
    if (editing) return selected.length === 0 ? 'Remove gallery' : 'Update gallery';
    if (selected.length === 0) return 'Add to article';
    return selected.length === 1 ? 'Add 1 item' : `Add ${selected.length} items`;
  });

  const placements: { value: GalleryPlacement; label: string; hint: string }[] = [
    { value: 'top', label: 'Top', hint: 'Above the article content' },
    { value: 'cursor', label: 'Cursor', hint: 'At the cursor position' },
    { value: 'end', label: 'End', hint: 'Below the article content (default)' }
  ];
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') onclose();
  }}
/>

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onclose();
  }}
>
  <div class="picker" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <strong>{title}</strong>
      <button class="close" aria-label="Close" onclick={() => onclose()}>✕</button>
    </header>

    <div class="scroll" bind:this={scroller}>
      {#if error}
        <div class="notice">
          <p class="error">{error}</p>
          <button class="retry" onclick={() => loadFirstPage()}>Try again</button>
        </div>
      {:else if loading && items.length === 0}
        <div class="grid" aria-hidden="true">
          {#each Array(12) as _, i (i)}
            <div class="cell skeleton"></div>
          {/each}
        </div>
      {:else if items.length === 0}
        <div class="notice">
          <p>No photos or videos in this trip yet.</p>
          <a href="/capture">Capture some first →</a>
        </div>
      {:else}
        <div class="grid">
          {#each items as item (item['@id'])}
            {@const order = badge.get(item.UID)}
            <button
              class="cell"
              class:selected={multiple && order !== undefined}
              aria-pressed={multiple ? order !== undefined : undefined}
              aria-label={item.title}
              onclick={() => (multiple ? toggle(item) : onpick?.(item))}
            >
              {#if itemThumbnail(item)}
                <img src={itemThumbnail(item)} alt="" loading="lazy" />
              {:else}
                <span class="fallback" aria-hidden="true">🎬</span>
              {/if}
              {#if item.kind === 'video'}
                <span class="video-mark" aria-hidden="true">▶</span>
              {/if}
              {#if multiple && order !== undefined}
                <span class="badge" aria-hidden="true">{order}</span>
              {/if}
            </button>
          {/each}
        </div>
        {#if nextUrl}
          <div class="sentinel" bind:this={sentinel}>
            {loading ? 'Loading more…' : ''}
          </div>
        {/if}
      {/if}
    </div>

    {#if multiple && !error && items.length > 0}
      <footer>
        <div class="selection-row">
          <span class="count">{selected.length} selected</span>
          <button
            class="sort"
            disabled={selected.length < 2}
            onclick={() => sortByCaptureTime()}
          >
            Sort by capture time
          </button>
        </div>
        <div class="action-row">
          {#if !editing}
            <div class="placement" role="radiogroup" aria-label="Gallery position">
              {#each placements as option (option.value)}
                <button
                  role="radio"
                  aria-checked={placement === option.value}
                  class:active={placement === option.value}
                  title={option.hint}
                  onclick={() => (placement = option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          {/if}
          <button
            class="primary"
            disabled={!editing && selected.length === 0}
            onclick={() => confirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </footer>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 16, 24, 0.55);
    display: grid;
    place-items: center;
    z-index: 50;
  }
  .picker {
    background: white;
    border-radius: 12px;
    width: min(92vw, 38rem);
    max-height: 85dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid #dbe1e8;
    flex-shrink: 0;
  }
  .close {
    border: none;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.4rem 0.6rem;
    margin: -0.4rem -0.6rem;
    border-radius: 6px;
  }
  .close:hover { background: #ecf3f4; }

  .scroll {
    overflow: auto;
    overscroll-behavior: contain;
    flex: 1;
    min-height: 14rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 2px;
    padding: 2px;
  }
  .cell {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    border: none;
    background: #e1eef0;
    cursor: pointer;
    overflow: hidden;
  }
  .cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 150ms ease-out;
  }
  .cell.selected {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }
  .cell.selected img { transform: scale(0.93); }
  .cell:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }
  .fallback {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: 1.6rem;
    background: #e4e8ee;
  }
  /* Centered Darkroom-tinted play disc: videos must be unmissable among
     photo tiles (same treatment as the editor gallery). */
  .video-mark {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(10, 16, 24, 0.55);
    color: white;
    font-size: 0.85rem;
    padding-left: 2px; /* optically center the triangle */
    box-sizing: border-box;
    pointer-events: none;
  }
  .badge {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 0.3rem;
    box-sizing: border-box;
    border-radius: 999px;
    background: var(--primary);
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    display: grid;
    place-items: center;
  }
  .skeleton {
    cursor: default;
    background: #e4e8ee;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% { opacity: 0.55; }
  }

  .notice {
    display: grid;
    gap: 0.6rem;
    justify-items: center;
    padding: 2.5rem 1rem;
    color: #5a6676;
    text-align: center;
  }
  .notice a { color: var(--primary); }
  .retry {
    font: inherit;
    padding: 0.5rem 1.2rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    background: white;
    cursor: pointer;
  }
  .error { color: #b3261e; margin: 0; }
  .sentinel { min-height: 2rem; text-align: center; color: #5a6676; }

  footer {
    flex-shrink: 0;
    border-top: 1px solid #dbe1e8;
    padding: 0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.6rem;
  }
  .selection-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }
  .count { color: #42555b; font-size: 0.9rem; }
  .sort {
    border: none;
    background: none;
    font: inherit;
    font-size: 0.9rem;
    color: var(--primary);
    cursor: pointer;
    padding: 0.35rem 0.5rem;
    margin: -0.35rem -0.5rem;
    border-radius: 6px;
  }
  .sort:hover:not(:disabled) { background: #ecf3f4; }
  .sort:disabled { color: #5a6676; opacity: 0.5; cursor: default; }
  .action-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .placement {
    display: flex;
    border: 1px solid #b8c0cc;
    border-radius: 6px;
    overflow: hidden;
  }
  .placement button {
    font: inherit;
    font-size: 0.9rem;
    padding: 0.45rem 0.8rem;
    border: none;
    background: white;
    color: #42555b;
    cursor: pointer;
  }
  .placement button + button { border-left: 1px solid #dbe1e8; }
  .placement button.active {
    background: #e1eef0;
    color: var(--primary);
    font-weight: 600;
  }
  .primary {
    font: inherit;
    padding: 0.5rem 1.2rem;
    border-radius: 6px;
    border: none;
    background: var(--primary);
    color: white;
    cursor: pointer;
    margin-left: auto;
  }
  .primary:disabled { opacity: 0.5; cursor: default; }

  @media (max-width: 640px) {
    .backdrop { place-items: stretch; }
    .picker {
      width: 100%;
      max-height: none;
      border-radius: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell img { transition: none; }
    .skeleton { animation: none; }
  }
</style>
