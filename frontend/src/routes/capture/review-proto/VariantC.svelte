<script lang="ts">
  /**
   * PROTOTYPE — Variant C: Import receipt.
   *
   * Position: the photos are not the subject of this screen — they were
   * already chosen, in Immich. What is left is a handful of exceptions. So
   * the default view is a receipt: one summary card, then one expandable row
   * per thing that actually needs a decision. The 200 photos live behind a
   * quiet "Review all individually" disclosure, because the ticket's own
   * premise is that most of them will never be touched.
   */
  import TagsInput from '$lib/components/TagsInput.svelte';
  import {
    fmtBytes,
    fmtDate,
    fmtRange,
    fmtTime,
    SUGGESTED_TAGS,
    type ProtoBatch,
    type ProtoItem
  } from './fixtures';

  let { batch, stage }: { batch: ProtoBatch; stage: string } = $props();

  let items = $state<ProtoItem[]>([]);
  let open = $state<string | null>(null);
  let allOpen = $state(false);
  let batchTags = $state<string[]>([]);

  $effect(() => {
    items = batch.items;
    open = null;
    allOpen = false;
  });

  const kept = $derived(items.filter((i) => !i.discarded));
  const dupes = $derived(kept.filter((i) => i.duplicateOf));
  const noGps = $derived(kept.filter((i) => !i.hasGps && i.capturedAt));
  const noDate = $derived(kept.filter((i) => !i.capturedAt));
  const bytes = $derived(kept.reduce((sum, i) => sum + i.originalBytes, 0));

  const toggle = (key: string) => (open = open === key ? null : key);

  let uploaded = $state(0);
  let failed = $state(0);
  $effect(() => {
    if (stage !== 'uploading') return;
    uploaded = 0;
    failed = 0;
    const timer = setInterval(() => {
      if (uploaded >= kept.length) return;
      uploaded += 1;
      if (uploaded % 47 === 0) failed += 1;
    }, 90);
    return () => clearInterval(timer);
  });
</script>

<a class="back" href="/capture">← Capture</a>

<div class="receipt">
  <p class="count">{kept.length}</p>
  <p class="unit">photos from Immich</p>
  <p class="sub">
    {fmtRange(kept)} · {fmtBytes(bytes)} of originals → {batch.tripTitle}
  </p>
  <div class="strip" aria-hidden="true">
    {#each kept.slice(0, 9) as item (item.id)}
      <img src={item.url} alt="" loading="lazy" />
    {/each}
    {#if kept.length > 9}<span class="more">+{kept.length - 9}</span>{/if}
  </div>

  {#if stage === 'uploading'}
    <div class="bar"><span style:width={`${(uploaded / Math.max(kept.length, 1)) * 100}%`}></span></div>
    <p class="progress">Uploading {Math.min(uploaded, kept.length)} of {kept.length}</p>
  {:else if kept.length < batch.share}
    <div class="bar"><span style:width={`${(kept.length / batch.share) * 100}%`}></span></div>
    <p class="progress">
      {kept.length} of {batch.share} imported ·
      <button class="linky">Resume ({batch.share - kept.length} left)</button>
    </p>
  {/if}
</div>

{#if stage === 'uploading'}
  {#if failed}
    <button class="row warn" onclick={() => toggle('failed')}>
      <span class="glyph">!</span>
      <span class="rowtext">{failed} uploads failed</span>
      <span class="chev">{open === 'failed' ? '▾' : '▸'}</span>
    </button>
    {#if open === 'failed'}
      <div class="panel">
        <p>They stay in the outbox and retry on their own. Nothing is lost.</p>
        <button class="ghost">Retry now</button>
      </div>
    {/if}
  {:else}
    <p class="calm">Nothing needs you. You can leave this screen.</p>
  {/if}
{:else}
  <div class="rows">
    {#if dupes.length}
      <button class="row warn" onclick={() => toggle('dupes')}>
        <span class="glyph">⧉</span>
        <span class="rowtext">{dupes.length} may already be in this trip</span>
        <span class="chev">{open === 'dupes' ? '▾' : '▸'}</span>
      </button>
      {#if open === 'dupes'}
        <div class="panel">
          <ul class="pairs">
            {#each dupes as item (item.id)}
              <li>
                <img src={item.url} alt="" loading="lazy" />
                <div>
                  <p class="pname">{item.title}</p>
                  <p class="pwhy">
                    same second as <code>{item.duplicateOf}</code> ·
                    {fmtDate(item.capturedAt)}
                    {fmtTime(item.capturedAt)}
                  </p>
                </div>
                <button class="ghost small" onclick={() => (item.discarded = true)}>Skip</button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}

    {#if noGps.length}
      <button class="row" onclick={() => toggle('nogps')}>
        <span class="glyph">◌</span>
        <span class="rowtext">{noGps.length} have no location</span>
        <span class="chev">{open === 'nogps' ? '▾' : '▸'}</span>
      </button>
      {#if open === 'nogps'}
        <div class="panel">
          <p>
            They will appear on the trip timeline but not on the map. Location rides on an Android
            permission and on sharing the original — nothing here can recover it.
          </p>
          <div class="strip small">
            {#each noGps.slice(0, 12) as item (item.id)}
              <img src={item.url} alt="" loading="lazy" />
            {/each}
            {#if noGps.length > 12}<span class="more">+{noGps.length - 12}</span>{/if}
          </div>
        </div>
      {/if}
    {/if}

    {#if noDate.length}
      <button class="row warn" onclick={() => toggle('nodate')}>
        <span class="glyph">?</span>
        <span class="rowtext">{noDate.length} have no capture date</span>
        <span class="chev">{open === 'nodate' ? '▾' : '▸'}</span>
      </button>
      {#if open === 'nodate'}
        <div class="panel">
          <p>
            Shared as 2 MP previews rather than originals, so they carry no date and will sort to
            the end of the timeline. Reshare them as originals to fix it.
          </p>
          <div class="strip small">
            {#each noDate as item (item.id)}<img src={item.url} alt="" />{/each}
          </div>
          <button class="ghost">Skip these {noDate.length}</button>
        </div>
      {/if}
    {/if}

    {#if batch.skipped.length}
      <button class="row" onclick={() => toggle('skipped')}>
        <span class="glyph">–</span>
        <span class="rowtext">{batch.skipped.length} files were skipped</span>
        <span class="chev">{open === 'skipped' ? '▾' : '▸'}</span>
      </button>
      {#if open === 'skipped'}
        <div class="panel">
          <ul class="plain">
            {#each batch.skipped as s (s.filename)}
              <li><code>{s.filename}</code> — {s.reason}</li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </div>

  <div class="tagblock">
    <span class="field-label">Tags for all of these</span>
    <TagsInput bind:value={batchTags} suggestions={SUGGESTED_TAGS} canCreate={true} />
  </div>

  <button class="disclose" onclick={() => (allOpen = !allOpen)}>
    {allOpen ? '▾' : '▸'} Review all {kept.length} individually
  </button>
  {#if allOpen}
    <ul class="grid">
      {#each kept as item (item.id)}
        <li><img src={item.url} alt="" loading="lazy" decoding="async" /></li>
      {/each}
    </ul>
  {/if}

  <div class="footer">
    <button class="save">Save {kept.length} to {batch.tripTitle}</button>
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
  .receipt {
    background: white;
    border-radius: 8px;
    padding: 1rem 0.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    margin-bottom: 1rem;
  }
  .count {
    margin: 0;
    font-size: 2.6rem;
    font-weight: 700;
    line-height: 1;
  }
  .unit {
    margin: 0.2rem 0 0;
    font-size: 1rem;
  }
  .sub {
    margin: 0.3rem 0 0.7rem;
    color: #42555b;
    font-size: 0.9rem;
  }
  .strip {
    display: flex;
    gap: 0.2rem;
    align-items: center;
    overflow: hidden;
  }
  .strip img {
    width: 3.2rem;
    height: 3.2rem;
    object-fit: cover;
    border-radius: 4px;
    flex: none;
  }
  .strip.small img {
    width: 2.4rem;
    height: 2.4rem;
  }
  .more {
    font-size: 0.85rem;
    color: #5a6676;
    padding-left: 0.2rem;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: #e1eef0;
    overflow: hidden;
    margin-top: 0.8rem;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--primary);
    transition: width 120ms linear;
  }
  .progress {
    margin: 0.4rem 0 0;
    font-size: 0.9rem;
    color: #42555b;
  }
  .rows {
    display: grid;
    gap: 0.3rem;
    margin-bottom: 1rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    font: inherit;
    text-align: left;
    background: white;
    border: none;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    min-height: 2.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    cursor: pointer;
  }
  .row.warn {
    background: #fdf3e3;
    box-shadow: none;
    border: 1px solid #e8c98a;
  }
  .glyph {
    width: 1.2rem;
    text-align: center;
    color: #42555b;
  }
  .rowtext {
    flex: 1;
  }
  .chev {
    color: #5a6676;
  }
  .panel {
    background: white;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    font-size: 0.9rem;
    color: #42555b;
    display: grid;
    gap: 0.6rem;
  }
  .panel p {
    margin: 0;
  }
  .pairs,
  .plain {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .plain {
    gap: 0.3rem;
  }
  .pairs li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .pairs img {
    width: 3rem;
    height: 3rem;
    object-fit: cover;
    border-radius: 4px;
    flex: none;
  }
  .pairs div {
    flex: 1;
    min-width: 0;
  }
  .pname {
    margin: 0;
    color: #1c2430;
  }
  .pwhy {
    margin: 0;
    font-size: 0.8rem;
  }
  .calm {
    color: #14691b;
    font-size: 0.9rem;
  }
  .field-label {
    font-size: 0.85rem;
    color: #42555b;
  }
  .tagblock {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-width: 28rem;
    margin-bottom: 1rem;
  }
  .disclose {
    font: inherit;
    font-size: 0.9rem;
    background: none;
    border: none;
    padding: 0.5rem 0;
    min-height: 2.5rem;
    color: var(--primary);
    cursor: pointer;
  }
  .grid {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
    gap: 0.25rem;
  }
  .grid li {
    aspect-ratio: 1;
  }
  .grid img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }
  .footer {
    position: sticky;
    bottom: var(--bottom-nav-clearance, 0px);
    display: flex;
    gap: 0.6rem;
    background: #f5f6f8;
    padding: 0.6rem 0;
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
    justify-self: start;
  }
  .ghost.small {
    padding: 0.4rem 0.7rem;
    min-height: 2.4rem;
    font-size: 0.85rem;
    flex: none;
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
