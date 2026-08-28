<script lang="ts">
  /** PROTOTYPE — throwaway. Floating variant bar; deliberately un-designed. */
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let {
    variants,
    names,
    current,
    stage,
    pageSize,
    share,
    imported
  }: {
    variants: string[];
    names: Record<string, string>;
    current: string;
    stage: string;
    pageSize: number;
    share: number;
    imported: number;
  } = $props();

  const dev = import.meta.env.DEV;

  function setParams(patch: Record<string, string>) {
    const url = new URL($page.url);
    for (const [k, v] of Object.entries(patch)) url.searchParams.set(k, v);
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function cycle(step: number) {
    const i = variants.indexOf(current);
    const next = variants[(i + step + variants.length) % variants.length];
    setParams({ variant: next });
  }

  function onKey(event: KeyboardEvent) {
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLElement && el.isContentEditable)
    )
      return;
    if (event.key === 'ArrowLeft') cycle(-1);
    if (event.key === 'ArrowRight') cycle(1);
  }
</script>

<svelte:window onkeydown={onKey} />

{#if dev}
  <div class="switcher">
    <div class="row">
      <button onclick={() => cycle(-1)} aria-label="Previous variant">←</button>
      <span class="label">{current} — {names[current]}</span>
      <button onclick={() => cycle(1)} aria-label="Next variant">→</button>
    </div>
    <div class="row knobs">
      <span class="tag">stage</span>
      <button class:on={stage === 'review'} onclick={() => setParams({ stage: 'review' })}
        >review</button
      >
      <button class:on={stage === 'uploading'} onclick={() => setParams({ stage: 'uploading' })}
        >upload</button
      >
      <span class="sep"></span>
      <span class="tag">page</span>
      {#each [12, 30, 60] as n (n)}
        <button class:on={pageSize === n} onclick={() => setParams({ n: String(n) })}>{n}</button>
      {/each}
    </div>
    <div class="row knobs">
      <span class="tag">share</span>
      {#each [30, 200] as s (s)}
        <button
          class:on={share === s}
          onclick={() => setParams({ share: String(s), imported: String(s) })}>{s}</button
        >
      {/each}
      <span class="sep"></span>
      <span class="tag">arrival</span>
      <button
        class:on={imported >= share}
        onclick={() => setParams({ imported: String(share) })}>full</button
      >
      <button
        class:on={imported < share}
        onclick={() => setParams({ imported: String(Math.max(1, Math.round(share * 0.4))) })}
        >partial</button
      >
    </div>
  </div>
{/if}

<style>
  .switcher {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--bottom-nav-clearance, 0px) + 0.6rem);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: center;
    background: #10151c;
    color: white;
    border-radius: 14px;
    padding: 0.4rem 0.7rem;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    font-size: 0.75rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .label {
    min-width: 11rem;
    text-align: center;
    font-weight: 600;
  }
  button {
    font: inherit;
    background: rgba(255, 255, 255, 0.12);
    color: white;
    border: none;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    cursor: pointer;
  }
  button.on {
    background: white;
    color: #10151c;
  }
  .knobs {
    opacity: 0.9;
    font-size: 0.7rem;
  }
  .tag {
    opacity: 0.55;
  }
  .sep {
    width: 1px;
    height: 0.9rem;
    background: rgba(255, 255, 255, 0.25);
  }
</style>
