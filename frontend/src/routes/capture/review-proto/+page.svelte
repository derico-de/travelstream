<script lang="ts">
  /**
   * PROTOTYPE — throwaway. Ticket 07 of the immich-import map.
   *
   * Round 2. Variant A won on 2026-08-18, with the premise corrected: shares
   * are small (~30, matching what mobile share sheets hand over), so a page
   * of the batch is reviewed at a time with room to edit metadata. A and D
   * are the two live readings of that verdict; B and C are round 1, kept for
   * comparison until the answer is folded into the real code.
   *
   *   A — Contact sheet   : grid of big tiles, editor expands inline
   *   D — Editable list   : today's review screen with a much bigger preview
   *   B — Triage stack    : (round 1) one at a time, oddities first
   *   C — Import receipt   : (round 1) don't show the photos, show exceptions
   *
   * URL knobs (also on the floating bar):
   *   ?variant=A|D|B|C  ?stage=review|uploading
   *   ?n=<page size>  ?share=<files in the share>  ?imported=<resized so far>
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import PrototypeSwitcher from './PrototypeSwitcher.svelte';
  import VariantA from './VariantA.svelte';
  import VariantB from './VariantB.svelte';
  import VariantC from './VariantC.svelte';
  import VariantD from './VariantD.svelte';
  import { buildBatch, releaseBatch, type ProtoBatch } from './fixtures';

  const NAMES: Record<string, string> = {
    A: 'Contact sheet',
    D: 'Editable list',
    B: 'Triage stack (r1)',
    C: 'Import receipt (r1)'
  };
  const VARIANTS = Object.keys(NAMES);

  const num = (key: string, fallback: number) => {
    const raw = Number($page.url.searchParams.get(key));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  };

  const variant = $derived(
    VARIANTS.includes($page.url.searchParams.get('variant') ?? '')
      ? ($page.url.searchParams.get('variant') as string)
      : 'A'
  );
  const stage = $derived(
    $page.url.searchParams.get('stage') === 'uploading' ? 'uploading' : 'review'
  );
  const pageSize = $derived(num('n', 30));
  const share = $derived(num('share', 30));
  const imported = $derived(num('imported', share));

  let batch = $state<ProtoBatch | null>(null);
  let built = $state(0);
  let building = $state(true);

  // Rebuild whenever the size knobs move; variant/stage switches reuse it.
  $effect(() => {
    const want = { pageSize, share, imported };
    let live = true;
    building = true;
    built = 0;
    void buildBatch(want.pageSize, want.share, want.imported, (n) => {
      if (live) built = n;
    }).then((next) => {
      if (!live) {
        releaseBatch(next);
        return;
      }
      releaseBatch(batch);
      batch = next;
      building = false;
    });
    return () => {
      live = false;
    };
  });

  onDestroy(() => {
    releaseBatch(batch);
    if (localStorage.getItem('travelstream.token') === 'PROTOTYPE-ONLY-FAKE-TOKEN') {
      localStorage.removeItem('travelstream.token');
    }
  });
</script>

{#if building || !batch}
  <p class="building">Building fake batch… {built} / {Math.min(pageSize, imported, share)}</p>
{:else if variant === 'A'}
  <VariantA {batch} {stage} />
{:else if variant === 'D'}
  <VariantD {batch} {stage} />
{:else if variant === 'B'}
  <VariantB {batch} {stage} />
{:else}
  <VariantC {batch} {stage} />
{/if}

<PrototypeSwitcher
  variants={VARIANTS}
  names={NAMES}
  current={variant}
  {stage}
  {pageSize}
  {share}
  {imported}
/>

<style>
  .building {
    color: #5a6676;
  }
</style>
