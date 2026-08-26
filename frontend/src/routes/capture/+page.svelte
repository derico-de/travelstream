<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/session';
  import { outbox, outboxItems } from '$lib/outbox';
  import { currentPosition } from '$lib/capture/exif';
  import { takePendingFlash } from '$lib/capture/flash';
  import { stageMediaFile } from '$lib/capture/stage';
  import { rememberLastTrip, recallLastTrip } from '$lib/capture/last-trip';
  import {
    formatBytes,
    requestPersistentStorage,
    storageStatus,
    type StorageStatus
  } from '$lib/capture/storage';
  import { contentPath } from '$lib/format';
  import type { Trip } from '$lib/api/types';
  import type { CaptureKind } from '$lib/outbox/types';

  let trips = $state<Trip[]>([]);
  // Keep filing into the current trip across capture routes and app sections.
  // The Trips overview is the deliberate boundary that clears this choice.
  let tripPath = $state($page.url.searchParams.get('trip') ?? recallLastTrip());
  let tripsState = $state<'loading' | 'ready' | 'offline'>('loading');
  let tripSelect = $state<HTMLSelectElement | null>(null);
  let flash = $state('');
  let flashError = $state('');
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  /* Navigating here from another trip's page re-targets and remembers it. */
  $effect(() => {
    const carried = $page.url.searchParams.get('trip');
    if (carried) {
      tripPath = carried;
      rememberLastTrip(carried);
    }
  });

  /**
   * Choosing is required whenever there is something to choose from.
   * Offline (or with no trips yet) capture stays unblocked: items wait in
   * the Outbox for a trip, which beats not capturing at all.
   */
  function requireTrip(event?: Event): boolean {
    if (tripPath || tripsState !== 'ready' || trips.length === 0) return false;
    event?.preventDefault();
    flash = '';
    flashError = 'Pick a trip first — captures file into a trip.';
    tripSelect?.focus();
    return true;
  }

  /** Items picked but not yet reviewed — an interrupted review to resume. */
  const staged = $derived($outboxItems.filter((i) => i.state === 'staged'));

  /** Confirmations expire so stale status never reads as fresh. */
  function showFlash(message: string) {
    flash = message;
    flashError = '';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flash = ''), 6000);
  }

  $effect(() => () => clearTimeout(flashTimer));
  let storage = $state<StorageStatus | null>(null);

  $effect(() => {
    // A save on /capture/note or /capture/review confirms here, where the
    // user lands afterwards.
    const pending = takePendingFlash();
    if (pending) showFlash(pending);
  });

  $effect(() => {
    // Ask for durable storage up front; surface eviction risk before
    // large captures (iOS quota honesty - ticket 17).
    requestPersistentStorage()
      .catch(() => false)
      .then(() => storageStatus())
      .then((status) => (storage = status))
      .catch(() => (storage = null));
  });

  /** Fetch GPS in the background and attach it to an already-safe item. */
  function attachPositionLater(id: string) {
    void currentPosition()
      .then((position) => outbox.amendPosition(id, position))
      .catch(() => {});
  }

  async function referenceCameraRoll() {
    if (requireTrip()) return;
    rememberLastTrip(tripPath);
    const title = window.prompt('Name this video — attach the file later from the Outbox');
    if (!title) return;
    try {
      const item = await outbox.enqueue({
        kind: 'video',
        tripPath,
        title,
        pendingAttachment: true
      });
      attachPositionLater(item.id);
      showFlash('Saved — attach the video file in the Outbox when you are back online.');
    } catch (error) {
      console.error(error);
      flashError = "Couldn't save — storage on this phone may be full. Free up space and try again.";
    }
  }

  $effect(() => {
    api.listTrips().then((items) => {
      trips = items;
      tripsState = 'ready';
    }).catch(() => {
      /* Offline: trips may be unavailable; the remembered selection remains
         active so capture can continue without another decision. */
      tripsState = 'offline';
    });
  });

  /** Offline fallback option when a different carried selection is active. */
  const rememberedTrip = recallLastTrip();

  /** Human-readable trip name for a path like "trips/transfagarasan-2026". */
  function tripDisplayName(path: string): string {
    const known = trips.find((t) => contentPath(t['@id']) === path);
    if (known) return known.title;
    return path.split('/').pop() ?? path;
  }

  /**
   * Stage picked files locally — persisted before anything else happens, so
   * a killed app loses nothing — then move to the review step for titles,
   * descriptions and tags. Upload starts only when review says so.
   */
  async function stageMedia(kind: CaptureKind, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    if (requireTrip()) return;
    rememberLastTrip(tripPath);
    try {
      for (const file of Array.from(fileList)) {
        await stageMediaFile(kind, tripPath, file, { attachPosition: true });
      }
      await goto('/capture/review');
    } catch (error) {
      console.error(error);
      flashError =
        "Couldn't save to this phone — storage may be full. Free up space and try again.";
    }
  }
</script>

<div class="screen">
  <h1>Capture</h1>

  {#if tripsState === 'ready' && trips.length === 0}
    <p class="trip-note">
      No trips yet — <a href="/trips/new">create your first trip</a> to give
      captures a home. Anything you save meanwhile waits in the
      <a href="/outbox">Outbox</a>.
    </p>
  {:else}
    <label class="trip-select">
      Trip
      <select
        bind:this={tripSelect}
        bind:value={tripPath}
        onchange={() => rememberLastTrip(tripPath)}
      >
        <option value="">Choose a trip…</option>
        {#each trips as trip (trip['@id'])}
          <option value={contentPath(trip['@id'])}>{trip.title}</option>
        {/each}
        <!-- Carried-in or remembered trips the (offline) list doesn't know. -->
        {#if tripPath && !trips.some((t) => contentPath(t['@id']) === tripPath)}
          <option value={tripPath}>{tripDisplayName(tripPath)}</option>
        {/if}
        {#if tripsState === 'offline' && rememberedTrip && rememberedTrip !== tripPath && !trips.some((t) => contentPath(t['@id']) === rememberedTrip)}
          <option value={rememberedTrip}>{tripDisplayName(rememberedTrip)}</option>
        {/if}
      </select>
    </label>
    {#if tripsState === 'offline'}
      <p class="trip-note">
        {#if tripPath}
          Trips can't load right now — filing to
          <strong>{tripDisplayName(tripPath)}</strong>. Everything is saved on
          this phone and uploads when you're back online.
        {:else}
          Trips can't load right now. Captures are saved on this phone and wait
          in the <a href="/outbox">Outbox</a> until you pick a trip.
        {/if}
      </p>
    {/if}
  {/if}

  <!-- Bottom-anchored: primary capture actions live in the thumb arc just
       above the bottom nav. Conditional content (warning, resume link,
       camera-roll) inserts inside this zone, so the tiles never shift
       after load. -->
  <div class="action-zone">
    {#if storage?.evictionRisk}
      <div class="storage-warning" role="alert">
        <strong>Storage warning:</strong>
        {#if storage.isIOS && !storage.persisted}
          if this iPhone runs low on space, iOS can delete what's saved here
          before it uploads.
          {#if !storage.standalone}
            Add this app to your Home Screen to keep captures safe.
          {/if}
        {:else}
          this phone's space for the app is nearly full
          ({formatBytes(storage.usageBytes)} of {formatBytes(storage.quotaBytes)} used).
        {/if}
        For long videos, use <em>Save a video for later</em> below and attach
        the file when you're back online.
      </div>
    {/if}

    {#if staged.length > 0}
      <a class="resume-review" href="/capture/review">
        {staged.length}
        {staged.length === 1 ? 'item' : 'items'} staged — finish review
      </a>
    {/if}

    {#if storage?.isIOS || storage?.evictionRisk}
      <button class="camera-roll" onclick={referenceCameraRoll}>
        🎞 Save a video for later — attach the file when online
      </button>
    {/if}

    <div class="capture-buttons">
      <label class="capture-button">
        <span class="tile-icon" aria-hidden="true">📸</span>
        <span class="tile-label">Photo</span>
        <!-- Guard on the input: label taps forward a click here, and
             keyboard activation lands here directly - preventDefault stops
             the picker until a trip is chosen. -->
        <input
          type="file"
          accept="image/*"
          multiple
          onclick={(e) => requireTrip(e)}
          onchange={(e) => stageMedia('photo', e.currentTarget.files)}
        />
      </label>
      <label class="capture-button">
        <span class="tile-icon" aria-hidden="true">🎬</span>
        <span class="tile-label">Video</span>
        <input
          type="file"
          accept="video/*"
          multiple
          onclick={(e) => requireTrip(e)}
          onchange={(e) => stageMedia('video', e.currentTarget.files)}
        />
      </label>
      <a
        class="capture-button"
        href={`/capture/note${tripPath ? `?trip=${encodeURIComponent(tripPath)}` : ''}`}
        onclick={(e) => requireTrip(e)}
      >
        <span class="tile-icon" aria-hidden="true">📝</span>
        <span class="tile-label">Note</span>
      </a>
    </div>

    <p class="flash" role="status">{flash}</p>
    {#if flashError}<p class="flash-error" role="alert">{flashError}</p>{/if}
  </div>
</div>

<style>
  .screen {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  h1 {
    margin: 0 0 1rem;
  }
  .trip-select {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-width: 28rem;
  }
  .trip-note {
    font-size: 0.85rem;
    color: #42555b;
    max-width: 28rem;
    margin: 0.3rem 0 0;
  }
  .trip-note a {
    color: var(--primary);
  }
  select, button {
    font: inherit;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    min-height: 2.75rem;
  }
  select {
    padding: 0.5rem;
  }
  button {
    padding: 0.5rem 1rem;
  }
  .action-zone {
    margin-top: auto;
    padding-top: 1.4rem;
  }
  .capture-buttons {
    display: flex;
    gap: 1rem;
  }
  .capture-button {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    flex: 1;
    background: white;
    padding: 1.4rem 0;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    cursor: pointer;
    color: inherit;
    text-decoration: none;
    transition: background-color 150ms ease-out;
  }
  .tile-icon {
    font-size: 1.5rem;
    line-height: 1;
  }
  .tile-label {
    font-weight: 600;
  }
  @media (hover: hover) {
    .capture-button:hover {
      background: #ecf3f4;
    }
  }
  .capture-button:active {
    background: #d4e5e8;
  }
  @media (prefers-reduced-motion: reduce) {
    .capture-button,
    .resume-review {
      transition: none;
    }
  }
  /* Keep the input focusable for keyboard/screen-reader capture:
     visually hidden, never display:none (that removes it from the tab
     order entirely). */
  .capture-button input {
    position: absolute;
    width: 1px;
    height: 1px;
    min-height: 0;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .capture-button:has(input:focus-visible),
  a.capture-button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .flash {
    color: #14691b;
    min-height: 1.5em;
    margin: 0.6rem 0 0;
  }
  .flash-error {
    color: #b3261e;
    margin: 0.3rem 0 0;
  }
  .storage-warning {
    background: #fdf3e3;
    border: 1px solid #e8c98a;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    margin: 0 0 1rem;
    font-size: 0.85rem;
  }
  .resume-review {
    display: block;
    box-sizing: border-box;
    width: 100%;
    margin: 0 0 0.6rem;
    padding: 0.6rem 1rem;
    min-height: 2.75rem;
    background: var(--primary-tint);
    border-radius: 8px;
    color: var(--primary);
    font-weight: 600;
    text-align: center;
    text-decoration: none;
    transition: background-color 150ms ease-out;
  }
  .resume-review:hover {
    background: #d4e5e8;
  }
  .resume-review:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .camera-roll {
    display: block;
    width: 100%;
    margin: 0 0 0.6rem;
    background: white;
    border: 1px dashed var(--primary);
    color: var(--primary);
    cursor: pointer;
  }
</style>
