<script lang="ts">
  import { tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/session';
  import { outbox } from '$lib/outbox';
  import { setPendingFlash } from '$lib/capture/flash';
  import TagsInput from '$lib/components/TagsInput.svelte';
  import { contentPath } from '$lib/format';
  import type { Trip } from '$lib/api/types';
  import type { CaptureKind } from '$lib/outbox/types';

  interface ReviewEntry {
    id: string;
    kind: CaptureKind;
    tripPath: string;
    title: string;
    description: string;
    descriptionOpen: boolean;
    tags: string[];
    /** Object URL for the staged blob; revoked on leave. */
    url: string | null;
  }

  let entries = $state<ReviewEntry[]>([]);
  let loaded = $state(false);
  let saving = $state(false);
  let batchTags = $state<string[]>([]);
  let trips = $state<Trip[]>([]);
  let keywordSuggestions = $state<string[]>([]);
  // Seeded from the last fetched settings; permissive when nothing is known
  // yet — the keyword-roles rule is widget courtesy, the server decides.
  let canAddKeywords = $state(api.settingsCached()?.can_add_keywords ?? true);
  let error = $state('');

  /**
   * Snapshot the staged queue once. Review owns these items until Save or
   * Discard; new picks always route back through /capture first.
   */
  $effect(() => {
    void outbox.list().then((items) => {
      const staged = items.filter((i) => i.state === 'staged');
      if (staged.length === 0) {
        void goto('/capture', { replaceState: true });
        return;
      }
      entries = staged.map((item) => ({
        id: item.id,
        kind: item.kind,
        tripPath: item.tripPath,
        title: item.title,
        description: item.description ?? '',
        descriptionOpen: Boolean(item.description),
        tags: item.tags ? [...item.tags] : [],
        url: item.blob ? URL.createObjectURL(item.blob) : null
      }));
      // What's on disk right now; the persister only writes real changes
      // (every update rewrites the stored blob alongside).
      for (const e of entries) {
        lastPersisted.set(
          e.id,
          JSON.stringify({ id: e.id, title: e.title, description: e.description, tags: [...e.tags] })
        );
      }
      // A reload mid-review restores batch tags as the ones every item shares.
      batchTags = entries.length
        ? entries[0].tags.filter((t) => entries.every((e) => e.tags.includes(t)))
        : [];
      prevBatchTags = [...batchTags];
      loaded = true;
    });
    return () => {
      for (const entry of entries) {
        if (entry.url) URL.revokeObjectURL(entry.url);
      }
    };
  });

  $effect(() => {
    api.listTrips().then((items) => (trips = items)).catch(() => {});
    api.keywords().then((items) => (keywordSuggestions = items)).catch(() => {});
    api.settings().then((s) => (canAddKeywords = s.can_add_keywords)).catch(() => {});
  });

  /** Batch tags flow onto every item; per-item chips stay editable on top. */
  let prevBatchTags: string[] = [];
  $effect(() => {
    const next = [...batchTags];
    if (!loaded) return;
    const added = next.filter((t) => !prevBatchTags.includes(t));
    const removed = prevBatchTags.filter((t) => !next.includes(t));
    prevBatchTags = next;
    if (added.length === 0 && removed.length === 0) return;
    for (const entry of entries) {
      const kept = entry.tags.filter((t) => !removed.includes(t));
      const grown = [...kept, ...added.filter((t) => !kept.includes(t))];
      entry.tags = grown;
    }
  });

  /**
   * Kill-safe review: every edit lands in IndexedDB shortly after typing
   * pauses, so a dead battery mid-review costs nothing. Only entries that
   * actually changed are written (each write rewrites the stored blob too).
   */
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const lastPersisted = new Map<string, string>();
  $effect(() => {
    const snapshot = entries.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      tags: [...e.tags]
    }));
    if (!loaded || saving) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      for (const s of snapshot) {
        const fingerprint = JSON.stringify(s);
        if (lastPersisted.get(s.id) === fingerprint) continue;
        lastPersisted.set(s.id, fingerprint);
        void outbox.amendDetails(s.id, {
          title: s.title,
          description: s.description,
          tags: s.tags
        });
      }
    }, 500);
  });
  $effect(() => () => clearTimeout(persistTimer));

  const nounFor = (kinds: Set<CaptureKind>, count: number): string => {
    const single = kinds.size === 1 ? [...kinds][0] : null;
    const word = single === 'photo' ? 'photo' : single === 'video' ? 'video' : 'item';
    return count === 1 ? word : `${word}s`;
  };
  const noun = $derived(nounFor(new Set(entries.map((e) => e.kind)), entries.length));

  /** One trip line in the header when the whole batch files together. */
  const singleTripPath = $derived.by(() => {
    const paths = new Set(entries.map((e) => e.tripPath));
    return paths.size === 1 ? entries[0]?.tripPath ?? '' : '';
  });

  function tripDisplayName(path: string): string {
    if (!path) return '';
    const known = trips.find((t) => contentPath(t['@id']) === path);
    if (known) return known.title;
    return path.split('/').pop() ?? path;
  }

  function uploadTail(): string {
    if (entries.some((e) => !e.tripPath)) return 'pick a trip in the Outbox to upload';
    return navigator.onLine ? 'uploading now' : 'uploads when you are back online';
  }

  async function saveAll(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    // `required` catches empty, not whitespace: point at the first blank
    // title instead of queueing an unnamed capture.
    const blank = entries.find((e) => !e.title.trim());
    if (blank) {
      error = 'Every item needs a title.';
      document.getElementById(`title-${blank.id}`)?.focus();
      return;
    }
    saving = true;
    clearTimeout(persistTimer);
    error = '';
    try {
      for (const entry of entries) {
        await outbox.amendDetails(entry.id, {
          title: entry.title.trim(),
          // Spread: $state arrays are Proxies, which IndexedDB's structured
          // clone rejects (DataCloneError) — persist plain data only.
          tags: [...entry.tags],
          description: entry.description
        });
      }
      await outbox.releaseStaged();
      setPendingFlash(`${entries.length} ${noun} saved — ${uploadTail()}.`);
      if (navigator.onLine) void outbox.drain();
      await goto('/capture');
    } catch (err) {
      console.error(err);
      saving = false;
      error = "Couldn't queue these — storage on this phone may be full. Your items are still staged.";
    }
  }

  async function discardAll() {
    const ok = window.confirm(
      `Discard ${entries.length} staged ${noun}? They haven't been uploaded.`
    );
    if (!ok) return;
    try {
      await outbox.discardStaged();
      await goto('/capture');
    } catch (err) {
      console.error(err);
      error = "Couldn't discard — try again, or delete items one by one in the Outbox.";
    }
  }
</script>

{#if loaded}
  <a class="back" href="/capture">← Capture</a>
  <header>
    <h1>Review {entries.length} {noun}</h1>
    {#if singleTripPath}
      <p class="filing">Filing to <strong>{tripDisplayName(singleTripPath)}</strong></p>
    {/if}
  </header>

  <form onsubmit={saveAll}>
    <div class="batch">
      <span class="field-label">Tags for all of these</span>
      <TagsInput
        bind:value={batchTags}
        suggestions={keywordSuggestions}
        canCreate={canAddKeywords}
      />
    </div>

    <ul class="items">
      {#each entries as entry (entry.id)}
        <li>
          <div class="thumb">
            {#if entry.url && entry.kind === 'photo'}
              <img src={entry.url} alt="" loading="lazy" />
            {:else if entry.url && entry.kind === 'video'}
              <!-- Muted metadata-preload video: the browser paints the first
                   frame as a poster; the glyph behind covers the rest. -->
              <span class="glyph" aria-hidden="true">🎬</span>
              <!-- svelte-ignore a11y_media_has_caption -->
              <video src={entry.url} preload="metadata" muted playsinline tabindex="-1"></video>
            {:else}
              <span class="glyph" aria-hidden="true">{entry.kind === 'video' ? '🎬' : '📸'}</span>
            {/if}
          </div>
          <div class="fields">
            <label>
              Title
              <input id={`title-${entry.id}`} bind:value={entry.title} required />
            </label>
            {#if entry.descriptionOpen}
              <label>
                Description
                <textarea id={`desc-${entry.id}`} rows="2" bind:value={entry.description}
                ></textarea>
              </label>
            {:else}
              <button
                type="button"
                class="add-description"
                onclick={async () => {
                  entry.descriptionOpen = true;
                  await tick();
                  document.getElementById(`desc-${entry.id}`)?.focus();
                }}
              >
                + Add description
              </button>
            {/if}
            <div class="item-tags">
              <span class="field-label">Tags</span>
              <TagsInput
                bind:value={entry.tags}
                suggestions={keywordSuggestions}
                canCreate={canAddKeywords}
              />
            </div>
            {#if !singleTripPath}
              <p class="item-trip">
                {entry.tripPath
                  ? `Filing to ${tripDisplayName(entry.tripPath)}`
                  : 'No trip yet — assign one in the Outbox'}
              </p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="footer">
      <button class="save" disabled={saving}>
        {saving ? 'Saving…' : `Save all ${entries.length}`}
      </button>
      <button type="button" class="discard" onclick={discardAll} disabled={saving}>
        Discard
      </button>
    </div>
  </form>
{:else}
  <p class="loading">Loading staged items…</p>
{/if}

<style>
  .back {
    display: inline-block;
    margin-bottom: 0.7rem;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    background: #e4e8ee;
    color: #1c2430;
    text-decoration: none;
    font-size: 0.9rem;
  }
  header {
    margin: 0 0 1.4rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .filing {
    margin: 0;
    color: #42555b;
    font-size: 0.9rem;
  }
  .batch {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-width: 28rem;
    margin-bottom: 1.4rem;
  }
  .field-label {
    font-size: 0.85rem;
    color: #42555b;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }
  li {
    display: flex;
    gap: 0.9rem;
    background: white;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
  }
  .thumb {
    position: relative;
    flex: none;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 6px;
    overflow: hidden;
    background: #10151c;
    display: grid;
    place-items: center;
  }
  .thumb img,
  .thumb video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .glyph {
    font-size: 1.5rem;
    line-height: 1;
  }
  .fields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: #42555b;
  }
  input,
  textarea {
    font: inherit;
    color: #1c2430;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    min-height: 2.75rem;
    box-sizing: border-box;
    width: 100%;
  }
  textarea {
    resize: vertical;
  }
  .add-description {
    align-self: flex-start;
    border: none;
    background: none;
    font: inherit;
    font-size: 0.85rem;
    color: var(--primary);
    padding: 0.35rem 0;
    min-height: 2rem;
    cursor: pointer;
  }
  .add-description:hover {
    text-decoration: underline;
  }
  .add-description:focus-visible,
  .save:focus-visible,
  .discard:focus-visible,
  .back:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .item-tags {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .item-trip {
    margin: 0;
    font-size: 0.8rem;
    color: #5a6676;
  }
  .error {
    color: #b3261e;
    margin: 0.6rem 0 0;
  }
  .loading {
    color: #5a6676;
  }
  /* Sticks just above the bottom nav while the list scrolls: the fast path
     (titles are prefilled) is one thumb-tap away at any scroll position.
     The nav itself keeps the screen's bottom edge. */
  .footer {
    position: sticky;
    bottom: var(--bottom-nav-clearance, 0px);
    z-index: 5;
    display: flex;
    gap: 0.6rem;
    background: #f5f6f8;
    padding: 0.6rem 0;
    margin-top: 0.4rem;
  }
  .save {
    flex: 1;
    font: inherit;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    min-height: 2.75rem;
    cursor: pointer;
    transition: background-color 150ms ease-out;
  }
  .save:hover:not(:disabled) {
    background: var(--primary-soft);
  }
  .save:disabled {
    opacity: 0.7;
    cursor: default;
  }
  .discard {
    font: inherit;
    background: white;
    color: #b3261e;
    border: 1px solid #b8c0cc;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    min-height: 2.75rem;
    cursor: pointer;
    transition: background-color 150ms ease-out;
  }
  .discard:hover:not(:disabled) {
    background: #ecf3f4;
  }
  @media (prefers-reduced-motion: reduce) {
    .save,
    .discard {
      transition: none;
    }
  }
  /* Curation comfort on a laptop: the thumb grows and fields breathe. */
  @media (min-width: 40rem) {
    .thumb {
      width: 6rem;
      height: 6rem;
    }
  }
</style>
