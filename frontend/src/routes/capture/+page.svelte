<script lang="ts">
  import { api } from '$lib/session';
  import { outbox } from '$lib/outbox';
  import { extractPhotoMetadata, currentPosition } from '$lib/capture/exif';
  import {
    formatBytes,
    requestPersistentStorage,
    storageStatus,
    type StorageStatus
  } from '$lib/capture/storage';
  import { contentPath, fromDatetimeLocal, tripIsActive } from '$lib/format';
  import type { Trip } from '$lib/api/types';
  import type { CaptureKind } from '$lib/outbox/types';

  let trips = $state<Trip[]>([]);
  let tripPath = $state('');
  let tripsState = $state<'loading' | 'ready' | 'offline'>('loading');
  let noteTitle = $state('');
  let noteText = $state('');
  let noteWhen = $state('');
  let flash = $state('');
  let flashError = $state('');
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  /** Confirmations expire so stale status never reads as fresh. */
  function showFlash(message: string) {
    flash = message;
    flashError = '';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flash = ''), 6000);
  }

  $effect(() => () => clearTimeout(flashTimer));
  let storage = $state<StorageStatus | null>(null);

  const LAST_TRIP_KEY = 'travelstream.lastTrip';

  $effect(() => {
    // Ask for durable storage up front; surface eviction risk before
    // large captures (iOS quota honesty - ticket 17).
    requestPersistentStorage()
      .catch(() => false)
      .then(() => storageStatus())
      .then((status) => (storage = status))
      .catch(() => (storage = null));
  });

  /**
   * Honest sync tail for save confirmations: what actually happens next
   * depends on trip + connectivity, so never claim more than we know.
   */
  function uploadNote(): string {
    if (!tripPath) return 'pick a trip in the Outbox to upload';
    return navigator.onLine ? 'uploading now' : 'uploads when you are back online';
  }

  /** Fetch GPS in the background and attach it to an already-safe item. */
  function attachPositionLater(id: string) {
    void currentPosition()
      .then((position) => outbox.amendPosition(id, position))
      .catch(() => {});
  }

  async function referenceCameraRoll() {
    rememberTrip();
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
      if (tripPath) return;
      const remembered = localStorage.getItem(LAST_TRIP_KEY);
      const active = items.find((t) => tripIsActive(t));
      if (remembered && items.some((t) => contentPath(t['@id']) === remembered)) {
        tripPath = remembered;
      } else if (active) {
        tripPath = contentPath(active['@id']);
      } else if (items[0]) {
        tripPath = contentPath(items[0]['@id']);
      }
    }).catch(() => {
      /* offline: trips may be unavailable; last trip path still works */
      tripsState = 'offline';
      const remembered = localStorage.getItem(LAST_TRIP_KEY);
      if (remembered && !tripPath) tripPath = remembered;
    });
  });

  /** Human-readable trip name for a path like "trips/transfagarasan-2026". */
  function tripDisplayName(path: string): string {
    const known = trips.find((t) => contentPath(t['@id']) === path);
    if (known) return known.title;
    return path.split('/').pop() ?? path;
  }

  function rememberTrip() {
    if (tripPath) localStorage.setItem(LAST_TRIP_KEY, tripPath);
  }

  async function captureMedia(kind: CaptureKind, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    rememberTrip();
    try {
      for (const file of Array.from(fileList)) {
        // EXIF is a fast local read; keep it. GPS can take seconds - the
        // item is committed first, position attached when it arrives.
        const metadata = kind === 'photo' ? await extractPhotoMetadata(file) : {};
        // Gallery picks often happen days after the moment: without EXIF
        // (videos, stripped photos) the file's own mtime is the honest
        // capture time, not "now".
        if (!metadata.capturedAt && file.lastModified) {
          metadata.capturedAt = new Date(file.lastModified).toISOString();
        }
        const item = await outbox.enqueue({
          kind,
          tripPath,
          title: file.name.replace(/\.[^.]+$/, ''),
          blob: file,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          ...metadata
        });
        if (item.latitude === undefined) attachPositionLater(item.id);
      }
      const count = fileList.length;
      const noun =
        kind === 'photo'
          ? count === 1 ? 'photo' : 'photos'
          : count === 1 ? 'video' : 'videos';
      showFlash(`${count} ${noun} saved — ${uploadNote()}.`);
      if (navigator.onLine) void outbox.drain();
    } catch (error) {
      console.error(error);
      flashError =
        "Couldn't save to this phone — storage may be full. Free up space and try again.";
    }
  }

  async function captureNote(event: SubmitEvent) {
    event.preventDefault();
    if (!noteTitle) return;
    rememberTrip();
    try {
      const item = await outbox.enqueue({
        kind: 'note',
        tripPath,
        title: noteTitle,
        text: noteText,
        // Notes about an earlier moment: honor the picked time, else "now".
        capturedAt: fromDatetimeLocal(noteWhen)
      });
      attachPositionLater(item.id);
      noteTitle = '';
      noteText = '';
      noteWhen = '';
      showFlash(`Note saved — ${uploadNote()}.`);
      if (navigator.onLine) void outbox.drain();
    } catch (error) {
      console.error(error);
      flashError =
        "Couldn't save the note — storage on this phone may be full. Free up space and try again.";
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
      <select bind:value={tripPath} onchange={rememberTrip}>
        {#each trips as trip (trip['@id'])}
          <option value={contentPath(trip['@id'])}>{trip.title}</option>
        {/each}
        {#if trips.length === 0 && tripPath}
          <option value={tripPath}>{tripDisplayName(tripPath)}</option>
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

  <form class="note" onsubmit={captureNote}>
    <h2>Note</h2>
    <label class="field">
      Title
      <input bind:value={noteTitle} required />
    </label>
    <label class="field">
      Note
      <textarea placeholder="What just happened?" rows="2" bind:value={noteText}></textarea>
    </label>
    <label class="field">
      When (leave empty for now)
      <input type="datetime-local" bind:value={noteWhen} />
    </label>
    <button>Save note</button>
  </form>

  <!-- Bottom-anchored: primary capture actions live in the thumb arc just
       above the bottom nav. Conditional content (warning, camera-roll)
       inserts inside this zone, so the tiles never shift after load. -->
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

    {#if storage?.isIOS || storage?.evictionRisk}
      <button class="camera-roll" onclick={referenceCameraRoll}>
        🎞 Save a video for later — attach the file when online
      </button>
    {/if}

    <div class="capture-buttons">
      <label class="capture-button">
        <span class="tile-icon" aria-hidden="true">📸</span>
        <span class="tile-label">Photo</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onchange={(e) => captureMedia('photo', e.currentTarget.files)}
        />
      </label>
      <label class="capture-button">
        <span class="tile-icon" aria-hidden="true">🎬</span>
        <span class="tile-label">Video</span>
        <input
          type="file"
          accept="video/*"
          onchange={(e) => captureMedia('video', e.currentTarget.files)}
        />
      </label>
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
  select, input, textarea, button {
    font: inherit;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    min-height: 2.75rem;
  }
  select, input, textarea {
    padding: 0.5rem;
  }
  button {
    padding: 0.5rem 1rem;
  }
  ::placeholder {
    color: #5a6676;
    opacity: 1;
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
    .capture-button {
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
  .capture-button:has(input:focus-visible) {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .note {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-width: 28rem;
    margin: 1.4rem 0 0;
  }
  .note h2 {
    margin: 0;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .note button {
    background: var(--primary);
    color: white;
    border: none;
    cursor: pointer;
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
