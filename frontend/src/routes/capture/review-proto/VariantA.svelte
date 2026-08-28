<script lang="ts">
  /**
   * PROTOTYPE — Variant A: Contact sheet, one page of ~30.
   *
   * Round 2, after the 2026-08-18 verdict. A share is reviewed a page at a
   * time, so the tiles get big enough to actually judge a photo, and per-item
   * metadata is edited *inline* — the expander opens full-width under the row
   * it belongs to, rather than in a modal. Nothing is refused: the rest of
   * the share waits, videos are held for a later step, and only genuinely
   * undecodable files are called skipped.
   *
   * Selection and inspection are separate affordances now that there is room:
   * the corner checkbox culls, the tile body opens the editor.
   */
  import TagsInput from '$lib/components/TagsInput.svelte';
  import {
    fmtBytes,
    fmtRange,
    fmtTime,
    fmtDate,
    SUGGESTED_TAGS,
    type ProtoBatch,
    type ProtoItem
  } from './fixtures';

  let { batch, stage }: { batch: ProtoBatch; stage: string } = $props();

  let items = $state<ProtoItem[]>([]);
  let selected = $state(new Set<string>());
  let filter = $state<'all' | 'dupes' | 'nogps' | 'nodate'>('all');
  let openId = $state<string | null>(null);
  let page = $state(1);
  let batchTags = $state<string[]>([]);
  let heldOpen = $state(false);

  $effect(() => {
    items = batch.items;
    selected = new Set();
    filter = 'all';
    openId = null;
    page = 1;
  });

  const kept = $derived(items.filter((i) => !i.discarded));
  const dupes = $derived(kept.filter((i) => i.duplicateOf));
  const noGps = $derived(kept.filter((i) => !i.hasGps && i.capturedAt));
  const noDate = $derived(kept.filter((i) => !i.capturedAt));
  const shown = $derived(
    filter === 'dupes' ? dupes : filter === 'nogps' ? noGps : filter === 'nodate' ? noDate : kept
  );

  const pages = $derived(Math.max(1, Math.ceil(batch.share / batch.pageSize)));
  const from = $derived((page - 1) * batch.pageSize + 1);
  const to = $derived(Math.min(page * batch.pageSize, batch.share));
  const held = $derived(batch.videosWaiting.length);

  function toggleSelect(item: ProtoItem, event: MouseEvent) {
    event.stopPropagation();
    const next = new Set(selected);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    selected = next;
  }

  function discardSelected() {
    for (const item of items) if (selected.has(item.id)) item.discarded = true;
    selected = new Set();
  }

  let uploaded = $state(0);
  let failed = $state(0);
  $effect(() => {
    if (stage !== 'uploading') return;
    uploaded = 0;
    failed = 0;
    const timer = setInterval(() => {
      if (uploaded >= kept.length) return;
      uploaded += 1;
      if (uploaded % 13 === 0) failed += 1;
    }, 220);
    return () => clearInterval(timer);
  });
</script>

<a class="back" href="/capture">← Capture</a>

<header>
  <h1>Import to {batch.tripTitle}</h1>
  <p class="sub">
    {#if batch.share > batch.pageSize}
      Photos <strong>{from}–{to}</strong> of {batch.share} · {fmtRange(kept)}
    {:else}
      {kept.length} photos · {fmtRange(kept)}
    {/if}
  </p>
</header>

{#if stage === 'uploading'}
  <div class="card" role="status">
    <div class="bar"><span style:width={`${(uploaded / Math.max(kept.length, 1)) * 100}%`}></span></div>
    <p class="line">
      Uploading <strong>{Math.min(uploaded, kept.length)} of {kept.length}</strong>
      {#if failed}· <button class="linky">{failed} failed — retry</button>{/if}
    </p>
    <p class="hint">You can leave this screen; the outbox keeps going.</p>
  </div>
{:else}
  {#if batch.imported < batch.share}
    <div class="card">
      <div class="bar"><span style:width={`${(batch.imported / batch.share) * 100}%`}></span></div>
      <p class="line">
        <strong>{batch.imported} of {batch.share}</strong> resized so far — the rest are still
        arriving. Review these now; the next page is ready when you are.
      </p>
    </div>
  {/if}

  <div class="batchtags">
    <span class="field-label">Tags for all {kept.length} on this page</span>
    <TagsInput bind:value={batchTags} suggestions={SUGGESTED_TAGS} canCreate={true} />
  </div>

  <div class="chips" role="group" aria-label="Filter">
    <button class:on={filter === 'all'} onclick={() => (filter = 'all')}>All {kept.length}</button>
    {#if dupes.length}
      <button class:on={filter === 'dupes'} onclick={() => (filter = 'dupes')}
        >⧉ {dupes.length} possible duplicate{dupes.length > 1 ? 's' : ''}</button
      >
    {/if}
    {#if noGps.length}
      <button class:on={filter === 'nogps'} onclick={() => (filter = 'nogps')}
        >◌ {noGps.length} without location</button
      >
    {/if}
    {#if noDate.length}
      <button class:on={filter === 'nodate'} onclick={() => (filter = 'nodate')}
        >? {noDate.length} without date</button
      >
    {/if}
  </div>

  {#if held || batch.skipped.length}
    <div class="held">
      <button class="held-head" onclick={() => (heldOpen = !heldOpen)}>
        {heldOpen ? '▾' : '▸'}
        {#if held}{held} video{held > 1 ? 's' : ''} waiting{/if}{#if held && batch.skipped.length}·{/if}{#if batch.skipped.length}{batch.skipped.length}
          file{batch.skipped.length > 1 ? 's' : ''} skipped{/if}
      </button>
      {#if heldOpen}
        <ul>
          {#each batch.videosWaiting as v (v)}
            <li><code>{v}</code> — kept for the video import step, not uploaded yet</li>
          {/each}
          {#each batch.skipped as s (s.filename)}
            <li class="bad"><code>{s.filename}</code> — {s.reason}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
{/if}

<ul class="grid">
  {#each shown as item, index (item.id)}
    <li class="cell">
      <button
        class="tile"
        class:open={openId === item.id}
        onclick={() => (openId = openId === item.id ? null : item.id)}
        aria-expanded={openId === item.id}
        aria-label={`${item.title}, ${fmtDate(item.capturedAt)} ${fmtTime(item.capturedAt)}`}
      >
        <img src={item.url} alt="" loading="lazy" decoding="async" />
        {#if stage === 'uploading'}
          <span class="veil" class:done={index < uploaded}>{index < uploaded ? '✓' : '…'}</span>
        {/if}
        <span class="caption">
          <span class="ct">{item.title}</span>
          <span class="cm">
            {fmtTime(item.capturedAt)}
            {#if item.duplicateOf}⧉{/if}{#if !item.hasGps}◌{/if}{#if !item.capturedAt}?{/if}
          </span>
        </span>
      </button>
      {#if stage !== 'uploading'}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span
          class="pick"
          class:on={selected.has(item.id)}
          role="checkbox"
          tabindex="0"
          aria-checked={selected.has(item.id)}
          aria-label={`Select ${item.title}`}
          onclick={(e) => toggleSelect(item, e)}>{selected.has(item.id) ? '✓' : ''}</span
        >
      {/if}
    </li>

    {#if openId === item.id && stage !== 'uploading'}
      <li class="editor">
        <p class="meta">
          {fmtDate(item.capturedAt)}
          {fmtTime(item.capturedAt)} · {item.hasGps ? '📍 has location' : 'no location'} ·
          {item.originalWidth}×{item.originalHeight} → {item.width}×{item.height} ·
          {fmtBytes(item.originalBytes)} original
        </p>
        {#if item.duplicateOf}
          <p class="dupe">⧉ Possibly the same photo as <code>{item.duplicateOf}</code></p>
        {/if}
        {#if !item.capturedAt}
          <p class="dupe">? Shared as a 2 MP preview — no date, no location, and it cannot be
            recovered here. Reshare the original to fix it.</p>
        {/if}
        <label>Title<input bind:value={item.title} /></label>
        <label>Description<textarea rows="2" bind:value={item.description}></textarea></label>
        <div class="tagrow">
          <span class="field-label">Tags</span>
          <TagsInput bind:value={item.tags} suggestions={SUGGESTED_TAGS} canCreate={true} />
        </div>
        <div class="editor-actions">
          <button class="ghost" onclick={() => (openId = null)}>Done</button>
          <button
            class="ghost danger"
            onclick={() => {
              item.discarded = true;
              openId = null;
            }}>Remove from import</button
          >
        </div>
      </li>
    {/if}
  {/each}
</ul>

{#if stage !== 'uploading'}
  <div class="footer">
    {#if selected.size}
      <span class="selcount">{selected.size} selected</span>
      <button class="ghost" onclick={() => (selected = new Set())}>Clear</button>
      <button class="ghost danger" onclick={discardSelected}>Remove</button>
    {:else}
      <button class="save" onclick={() => (page = Math.min(page + 1, pages))}>
        Save these {kept.length}{#if page < pages}&nbsp;· next {Math.min(
            batch.pageSize,
            batch.share - to
          )}{/if}
      </button>
      <button class="ghost danger">Discard</button>
    {/if}
  </div>
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
    margin: 0 0 1rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .sub {
    margin: 0;
    color: #42555b;
    font-size: 0.9rem;
  }
  .field-label {
    font-size: 0.85rem;
    color: #42555b;
  }
  .batchtags {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-width: 28rem;
    margin-bottom: 1rem;
  }
  .card {
    background: white;
    border-radius: 8px;
    padding: 0.8rem 0.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    margin-bottom: 1rem;
  }
  .line {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
  }
  .hint {
    margin: 0.2rem 0 0;
    color: #5a6676;
    font-size: 0.85rem;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: #e1eef0;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--primary);
    transition: width 150ms ease-out;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.6rem;
  }
  .chips button {
    font: inherit;
    font-size: 0.85rem;
    background: white;
    border: 1px solid #dbe1e8;
    border-radius: 999px;
    padding: 0.4rem 0.8rem;
    min-height: 2.4rem;
    color: #1c2430;
    cursor: pointer;
  }
  .chips button.on {
    background: var(--primary-tint);
    border-color: var(--primary-tint-active);
    color: var(--primary);
    font-weight: 600;
  }
  .held {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    padding: 0.6rem 0.9rem;
    margin-bottom: 0.9rem;
    font-size: 0.85rem;
  }
  .held-head {
    font: inherit;
    font-size: 0.85rem;
    background: none;
    border: none;
    padding: 0;
    min-height: 1.8rem;
    color: #1c2430;
    cursor: pointer;
  }
  .held ul {
    margin: 0.5rem 0 0;
    padding-left: 1rem;
    color: #42555b;
  }
  .held .bad {
    color: #b3261e;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: 0.5rem;
  }
  .cell {
    position: relative;
    aspect-ratio: 1;
  }
  .tile {
    position: absolute;
    inset: 0;
    padding: 0;
    border: none;
    border-radius: 8px;
    overflow: hidden;
    background: #10151c;
    cursor: pointer;
  }
  .tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .tile.open {
    outline: 3px solid var(--primary);
    outline-offset: -3px;
  }
  .caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.3rem;
    padding: 0.9rem 0.45rem 0.35rem;
    background: linear-gradient(rgba(16, 21, 28, 0), rgba(16, 21, 28, 0.72));
    color: white;
    font-size: 0.72rem;
  }
  .ct {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cm {
    flex: none;
    opacity: 0.85;
  }
  .pick {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    width: 1.9rem;
    height: 1.9rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.85);
    background: rgba(16, 21, 28, 0.35);
    color: white;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .pick.on {
    background: var(--primary);
    border-color: white;
  }
  .veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(245, 246, 248, 0.72);
    color: #14691b;
    font-size: 1.4rem;
  }
  .veil.done {
    background: rgba(245, 246, 248, 0.2);
  }
  .editor {
    grid-column: 1 / -1;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    padding: 0.8rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .meta,
  .dupe {
    margin: 0;
    font-size: 0.85rem;
    color: #42555b;
  }
  .editor label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: #42555b;
  }
  .editor input,
  .editor textarea {
    font: inherit;
    color: #1c2430;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    min-height: 2.75rem;
    box-sizing: border-box;
    width: 100%;
  }
  .tagrow {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .editor-actions {
    display: flex;
    gap: 0.6rem;
  }
  .footer {
    position: sticky;
    bottom: var(--bottom-nav-clearance, 0px);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: #f5f6f8;
    padding: 0.6rem 0;
    margin-top: 0.8rem;
  }
  .selcount {
    flex: 1;
    font-size: 0.9rem;
    color: #42555b;
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
  }
  .ghost {
    font: inherit;
    background: white;
    color: #1c2430;
    border: 1px solid #b8c0cc;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    min-height: 2.75rem;
    cursor: pointer;
  }
  .ghost.danger {
    color: #b3261e;
  }
  .linky {
    font: inherit;
    font-size: 0.9rem;
    background: none;
    border: none;
    padding: 0;
    color: var(--primary);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
