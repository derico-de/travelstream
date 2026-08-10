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
  import { contentPath, tripIsActive } from '$lib/format';
  import type { Trip } from '$lib/api/types';
  import type { CaptureKind } from '$lib/outbox/types';

  let trips = $state<Trip[]>([]);
  let tripPath = $state('');
  let noteTitle = $state('');
  let noteText = $state('');
  let flash = $state('');
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

  async function referenceCameraRoll() {
    if (!tripPath) return;
    rememberTrip();
    const title = window.prompt('Clip name (attach the file when back online)');
    if (!title) return;
    const position = await currentPosition();
    await outbox.enqueue({
      kind: 'video',
      tripPath,
      title,
      pendingAttachment: true,
      ...position
    });
    flash = 'Reference queued - attach the video from the outbox when online.';
  }

  $effect(() => {
    api.listTrips().then((items) => {
      trips = items;
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
      const remembered = localStorage.getItem(LAST_TRIP_KEY);
      if (remembered && !tripPath) tripPath = remembered;
    });
  });

  function rememberTrip() {
    if (tripPath) localStorage.setItem(LAST_TRIP_KEY, tripPath);
  }

  async function captureMedia(kind: CaptureKind, fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !tripPath) return;
    rememberTrip();
    for (const file of Array.from(fileList)) {
      const metadata =
        kind === 'photo' ? await extractPhotoMetadata(file) : await currentPosition();
      await outbox.enqueue({
        kind,
        tripPath,
        title: file.name.replace(/\.[^.]+$/, ''),
        blob: file,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        ...metadata
      });
    }
    flash = `${fileList.length} item(s) queued.`;
    if (navigator.onLine) void outbox.drain();
  }

  async function captureNote(event: SubmitEvent) {
    event.preventDefault();
    if (!noteTitle || !tripPath) return;
    rememberTrip();
    const position = await currentPosition();
    await outbox.enqueue({
      kind: 'note',
      tripPath,
      title: noteTitle,
      text: noteText,
      ...position
    });
    noteTitle = '';
    noteText = '';
    flash = 'Note queued.';
    if (navigator.onLine) void outbox.drain();
  }
</script>

<h1>Capture</h1>

<label class="trip-select">
  Trip
  <select bind:value={tripPath} onchange={rememberTrip}>
    {#each trips as trip (trip['@id'])}
      <option value={contentPath(trip['@id'])}>{trip.title}</option>
    {/each}
    {#if trips.length === 0 && tripPath}
      <option value={tripPath}>{tripPath}</option>
    {/if}
  </select>
</label>

{#if flash}<p class="flash">{flash}</p>{/if}

{#if storage?.evictionRisk}
  <div class="storage-warning">
    <strong>Storage warning:</strong>
    {#if storage.isIOS && !storage.persisted}
      iOS may evict locally stored captures.
      {#if !storage.standalone}
        Install this app to your home screen for durable storage.
      {/if}
    {:else}
      Local storage is nearly full
      ({formatBytes(storage.usageBytes)} of {formatBytes(storage.quotaBytes)} used).
    {/if}
    For long videos, prefer <em>Reference camera roll</em> below and attach
    the file once you are back online.
  </div>
{/if}

<div class="capture-buttons">
  <label class="capture-button">
    📷 Photo
    <input
      type="file"
      accept="image/*"
      capture="environment"
      multiple
      onchange={(e) => captureMedia('photo', e.currentTarget.files)}
    />
  </label>
  <label class="capture-button">
    🎬 Video
    <input
      type="file"
      accept="video/*"
      capture="environment"
      onchange={(e) => captureMedia('video', e.currentTarget.files)}
    />
  </label>
</div>

{#if storage?.isIOS || storage?.evictionRisk}
  <button class="camera-roll" onclick={referenceCameraRoll}>
    🎞 Reference camera-roll video (attach when online)
  </button>
{/if}

<form class="note" onsubmit={captureNote}>
  <h2>Note</h2>
  <input placeholder="Title" bind:value={noteTitle} required />
  <textarea placeholder="What just happened?" rows="4" bind:value={noteText}></textarea>
  <button>Queue note</button>
</form>

<style>
  .trip-select {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-width: 20rem;
  }
  select, input, textarea, button {
    font: inherit;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
  }
  .capture-buttons {
    display: flex;
    gap: 1rem;
    margin: 1.2rem 0;
  }
  .capture-button {
    flex: 1;
    text-align: center;
    background: white;
    padding: 1.4rem 0;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
    cursor: pointer;
  }
  .capture-button input { display: none; }
  .note {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-width: 28rem;
  }
  .note button {
    background: #1a3c5e;
    color: white;
    border: none;
    cursor: pointer;
  }
  .flash { color: #14691b; }
  .storage-warning {
    background: #fdf3e3;
    border: 1px solid #e8c98a;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    margin: 0.8rem 0;
    font-size: 0.9rem;
  }
  .camera-roll {
    display: block;
    width: 100%;
    margin-bottom: 1.2rem;
    background: white;
    border: 1px dashed #1a3c5e;
    color: #1a3c5e;
    cursor: pointer;
  }
</style>
