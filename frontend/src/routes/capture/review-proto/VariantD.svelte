<script lang="ts">
  /**
   * PROTOTYPE — Variant D: Editable list, one page of ~30.
   *
   * The other reading of the 2026-08-18 verdict. Where A keeps the contact
   * sheet and opens an editor on demand, D takes today's /capture/review
   * literally — one card per photo, every field already open — and simply
   * grows the preview from 4.5rem to something you can actually judge, which
   * only becomes affordable because a page is ~30 rather than 200.
   *
   * The trade is explicit: no culling grid and a much longer scroll, in
   * exchange for never having to open anything to type a caption.
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
  let page = $state(1);
  let batchTags = $state<string[]>([]);
  let heldOpen = $state(false);

  $effect(() => {
    items = batch.items;
    page = 1;
  });

  const kept = $derived(items.filter((i) => !i.discarded));
  const noGps = $derived(kept.filter((i) => !i.hasGps && i.capturedAt));
  const pages = $derived(Math.max(1, Math.ceil(batch.share / batch.pageSize)));
  const from = $derived((page - 1) * batch.pageSize + 1);
  const to = $derived(Math.min(page * batch.pageSize, batch.share));
  const held = $derived(batch.videosWaiting.length);

  let uploaded = $state(0);
  $effect(() => {
    if (stage !== 'uploading') return;
    uploaded = 0;
    const timer = setInterval(() => {
      if (uploaded < kept.length) uploaded += 1;
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
    {#if noGps.length}· {noGps.length} without location{/if}
  </p>
</header>

{#if stage === 'uploading'}
  <div class="card" role="status">
    <div class="bar"><span style:width={`${(uploaded / Math.max(kept.length, 1)) * 100}%`}></span></div>
    <p class="line">Uploading <strong>{Math.min(uploaded, kept.length)} of {kept.length}</strong></p>
  </div>
{:else}
  {#if batch.imported < batch.share}
    <div class="card">
      <div class="bar"><span style:width={`${(batch.imported / batch.share) * 100}%`}></span></div>
      <p class="line"><strong>{batch.imported} of {batch.share}</strong> resized so far.</p>
    </div>
  {/if}

  <div class="batchtags">
    <span class="field-label">Tags for all {kept.length} on this page</span>
    <TagsInput bind:value={batchTags} suggestions={SUGGESTED_TAGS} canCreate={true} />
  </div>

  {#if held || batch.skipped.length}
    <div class="held">
      <button class="held-head" onclick={() => (heldOpen = !heldOpen)}>
        {heldOpen ? '▾' : '▸'}
        {#if held}{held} video{held > 1 ? 's' : ''} waiting{/if}{#if held && batch.skipped.length}·{/if}{#if batch.skipped.length}{batch.skipped.length}
          skipped{/if}
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

<ul class="list">
  {#each kept as item, index (item.id)}
    <li class="row" class:sending={stage === 'uploading'}>
      <div class="preview">
        <img src={item.url} alt="" loading="lazy" decoding="async" />
        {#if stage === 'uploading'}
          <span class="veil">{index < uploaded ? '✓ uploaded' : 'waiting'}</span>
        {/if}
      </div>

      <div class="fields">
        <p class="meta">
          {fmtDate(item.capturedAt)}
          {fmtTime(item.capturedAt)} · {item.hasGps ? '📍' : 'no location'} ·
          {fmtBytes(item.originalBytes)} → {item.width}×{item.height}
        </p>
        {#if item.duplicateOf}
          <p class="warn">⧉ Possibly the same photo as <code>{item.duplicateOf}</code></p>
        {/if}
        {#if !item.capturedAt}
          <p class="warn">? Shared as a 2 MP preview — no date or location</p>
        {/if}
        {#if stage !== 'uploading'}
          <label>Title<input bind:value={item.title} /></label>
          <label>Description<textarea rows="2" bind:value={item.description}></textarea></label>
          <div class="tagrow">
            <span class="field-label">Tags</span>
            <TagsInput bind:value={item.tags} suggestions={SUGGESTED_TAGS} canCreate={true} />
          </div>
          <button class="remove" onclick={() => (item.discarded = true)}>Remove from import</button>
        {/if}
      </div>
    </li>
  {/each}
</ul>

{#if stage !== 'uploading'}
  <div class="footer">
    <button class="save" onclick={() => (page = Math.min(page + 1, pages))}>
      Save these {kept.length}{#if page < pages}&nbsp;· next {Math.min(
          batch.pageSize,
          batch.share - to
        )}{/if}
    </button>
    <button class="ghost danger">Discard</button>
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
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }
  .row {
    background: white;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .preview {
    position: relative;
    background: #10151c;
    border-radius: 6px;
    overflow: hidden;
    aspect-ratio: 4 / 3;
  }
  .preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .veil {
    position: absolute;
    inset: auto 0 0 0;
    background: rgba(16, 21, 28, 0.65);
    color: white;
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .meta,
  .warn {
    margin: 0;
    font-size: 0.85rem;
    color: #42555b;
  }
  .warn {
    color: #1c2430;
    background: #fdf3e3;
    border: 1px solid #e8c98a;
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
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
  .tagrow {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .remove {
    align-self: flex-start;
    font: inherit;
    font-size: 0.85rem;
    background: none;
    border: none;
    padding: 0.35rem 0;
    min-height: 2rem;
    color: #b3261e;
    cursor: pointer;
  }
  .footer {
    position: sticky;
    bottom: var(--bottom-nav-clearance, 0px);
    z-index: 5;
    display: flex;
    gap: 0.6rem;
    background: #f5f6f8;
    padding: 0.6rem 0;
    margin-top: 0.8rem;
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
  /* Curation comfort on a laptop: preview beside the fields, not above. */
  @media (min-width: 40rem) {
    .row {
      flex-direction: row;
      align-items: flex-start;
    }
    .preview {
      flex: none;
      width: 16rem;
    }
    .fields {
      flex: 1;
    }
  }
</style>
