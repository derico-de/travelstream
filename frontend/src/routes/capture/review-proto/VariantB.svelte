<script lang="ts">
  /**
   * PROTOTYPE — Variant B: Triage stack.
   *
   * Position: 200 photos is not a list problem, it is a "how few of these do
   * I actually have to look at" problem. Only the items that need a *decision*
   * (possible duplicate, no capture date) are queued, one big photo at a time,
   * thumb-first. A missing location is a batch fact, not a per-item decision,
   * so it never stops the stack — it is one line in the summary. When the
   * short queue is empty the screen says so and offers Save; flipping through
   * all 200 is available but never required.
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
  let cursor = $state(0);
  let browsingAll = $state(false);
  let captionOpen = $state(false);
  let batchTags = $state<string[]>([]);

  $effect(() => {
    items = batch.items;
    cursor = 0;
    browsingAll = false;
  });

  const kept = $derived(items.filter((i) => !i.discarded));
  const needsDecision = $derived(kept.filter((i) => i.duplicateOf || !i.capturedAt));
  const noGps = $derived(kept.filter((i) => !i.hasGps && i.capturedAt));
  const queue = $derived(browsingAll ? kept : needsDecision);
  const current = $derived(queue[cursor] ?? null);

  function why(item: ProtoItem): string {
    if (item.duplicateOf) return `Possibly the same photo as ${item.duplicateOf}`;
    if (!item.capturedAt) return 'No capture date — shared as a 2 MP preview, not the original';
    return '';
  }

  function advance() {
    cursor += 1;
    captionOpen = false;
  }
  function discard() {
    if (current) current.discarded = true;
    captionOpen = false;
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
      if (uploaded % 47 === 0) failed += 1;
    }, 90);
    return () => clearInterval(timer);
  });
</script>

{#if stage === 'uploading'}
  <!-- Deliberately not the triage screen: once saved there is nothing to
       decide, so the screen collapses to one number. -->
  <a class="back" href="/capture">← Capture</a>
  <div class="done big">
    <h1>Uploading to {batch.tripTitle}</h1>
    <div class="bar">
      <span style:width={`${(uploaded / Math.max(kept.length, 1)) * 100}%`}></span>
    </div>
    <p class="count">{Math.min(uploaded, kept.length)} of {kept.length}</p>
    {#if failed}<p class="fail">{failed} failed — they stay in the outbox and retry</p>{/if}
    <p class="hint">Leave whenever you like. The outbox does not need this screen.</p>
    <a class="ghost-link" href="/capture">Back to capture</a>
  </div>
{:else if current}
  <div class="stage">
    <div class="topline">
      <a class="back" href="/capture">←</a>
      <div class="progress">
        <span class="stepcount">
          {browsingAll ? 'Photo' : 'Needs you'}
          {cursor + 1} of {queue.length}
        </span>
        <div class="bar thin">
          <span style:width={`${((cursor + 1) / Math.max(queue.length, 1)) * 100}%`}></span>
        </div>
      </div>
      <button class="skiplink" onclick={() => (cursor = queue.length)}>
        Keep the rest
      </button>
    </div>

    {#if !browsingAll}
      <p class="why">{why(current)}</p>
    {/if}

    <div class="frame">
      <img src={current.url} alt="" />
    </div>

    <p class="meta">
      {fmtDate(current.capturedAt)}
      {fmtTime(current.capturedAt)} · {current.hasGps ? '📍 has location' : 'no location'} ·
      {fmtBytes(current.originalBytes)} original
    </p>

    {#if captionOpen}
      <textarea rows="2" placeholder="Caption" bind:value={current.description}></textarea>
    {:else}
      <button class="addcap" onclick={() => (captionOpen = true)}>+ Add caption</button>
    {/if}

    <div class="filmstrip" aria-hidden="true">
      {#each queue.slice(cursor + 1, cursor + 9) as next (next.id)}
        <img src={next.url} alt="" loading="lazy" />
      {/each}
    </div>

    <div class="actions">
      <button
        class="act discard"
        onclick={() => {
          discard();
          advance();
        }}>✕ Discard</button
      >
      <button class="act keep" onclick={advance}>✓ Keep</button>
    </div>
  </div>
{:else}
  <a class="back" href="/capture">← Capture</a>
  <div class="done">
    <h1>{kept.length} photos ready</h1>
    <p class="sub">{fmtRange(kept)} · filing to <strong>{batch.tripTitle}</strong></p>

    <ul class="facts">
      {#if needsDecision.length === 0}
        <li class="ok">✓ Nothing else needs a decision</li>
      {/if}
      {#if noGps.length}
        <li>◌ {noGps.length} have no location — they will sit on the timeline, not the map</li>
      {/if}
      {#if batch.skipped.length}
        <li>
          {batch.skipped.length} files were skipped:
          {#each batch.skipped as s, i (s.filename)}<code>{s.filename}</code>{i <
            batch.skipped.length - 1
              ? ', '
              : ''}{/each}
        </li>
      {/if}
      {#if kept.length < batch.share}
        <li>{batch.share - kept.length} still importing — resume any time</li>
      {/if}
    </ul>

    <div class="tagblock">
      <span class="field-label">Tags for all of these</span>
      <TagsInput bind:value={batchTags} suggestions={SUGGESTED_TAGS} canCreate={true} />
    </div>

    <button class="save">Save {kept.length} to {batch.tripTitle}</button>
    <button
      class="ghost"
      onclick={() => {
        browsingAll = true;
        cursor = 0;
      }}>Flip through all {kept.length} anyway</button
    >
  </div>
{/if}

<style>
  .back {
    display: inline-block;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    background: #e4e8ee;
    color: #1c2430;
    text-decoration: none;
    font-size: 0.9rem;
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .topline {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .progress {
    flex: 1;
    min-width: 0;
  }
  .stepcount {
    font-size: 0.85rem;
    color: #42555b;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: #e1eef0;
    overflow: hidden;
  }
  .bar.thin {
    height: 4px;
    margin-top: 0.2rem;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--primary);
    transition: width 150ms ease-out;
  }
  .skiplink {
    font: inherit;
    font-size: 0.85rem;
    background: none;
    border: 1px solid #b8c0cc;
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    min-height: 2.4rem;
    color: var(--primary);
    cursor: pointer;
  }
  .why {
    margin: 0;
    background: #fdf3e3;
    border: 1px solid #e8c98a;
    border-radius: 8px;
    padding: 0.5rem 0.7rem;
    font-size: 0.9rem;
  }
  .frame {
    background: #10151c;
    border-radius: 8px;
    height: 46dvh;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .frame img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .meta {
    margin: 0;
    font-size: 0.85rem;
    color: #42555b;
  }
  .addcap {
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
  textarea {
    font: inherit;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    box-sizing: border-box;
    width: 100%;
    resize: vertical;
  }
  .filmstrip {
    display: flex;
    gap: 0.25rem;
    overflow-x: auto;
  }
  .filmstrip img {
    width: 3rem;
    height: 3rem;
    object-fit: cover;
    border-radius: 4px;
    flex: none;
    opacity: 0.55;
  }
  .actions {
    position: sticky;
    bottom: var(--bottom-nav-clearance, 0px);
    display: flex;
    gap: 0.6rem;
    background: #f5f6f8;
    padding: 0.6rem 0;
  }
  .act {
    flex: 1;
    font: inherit;
    font-size: 1.05rem;
    border-radius: 8px;
    min-height: 3.4rem;
    cursor: pointer;
  }
  .act.keep {
    background: var(--primary);
    color: white;
    border: none;
    flex: 1.6;
  }
  .act.discard {
    background: white;
    color: #b3261e;
    border: 1px solid #b8c0cc;
  }
  .done {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-top: 1rem;
  }
  .done.big {
    gap: 0.5rem;
  }
  h1 {
    margin: 0;
  }
  .sub {
    margin: 0;
    color: #42555b;
    font-size: 0.9rem;
  }
  .count {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
  .fail {
    margin: 0;
    color: #b3261e;
    font-size: 0.9rem;
  }
  .hint {
    margin: 0;
    color: #5a6676;
    font-size: 0.85rem;
  }
  .ghost-link {
    align-self: flex-start;
    color: var(--primary);
  }
  .facts {
    list-style: none;
    margin: 0;
    padding: 0.7rem 0.9rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    display: grid;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: #42555b;
  }
  .facts .ok {
    color: #14691b;
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
  }
  .save {
    font: inherit;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.7rem 1rem;
    min-height: 3rem;
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
</style>
