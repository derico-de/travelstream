<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/session';
  import { outbox } from '$lib/outbox';
  import { currentPosition } from '$lib/capture/exif';
  import { setPendingFlash } from '$lib/capture/flash';
  import { contentPath, fromDatetimeLocal } from '$lib/format';
  import type { Trip } from '$lib/api/types';

  // The trip was chosen on the capture screen and carried along explicitly;
  // arriving without one (offline deadlock) falls back to the Outbox flow.
  const tripPath = $page.url.searchParams.get('trip') ?? '';

  let trips = $state<Trip[]>([]);
  let title = $state('');
  let text = $state('');
  let when = $state('');
  let saving = $state(false);
  let error = $state('');

  $effect(() => {
    api.listTrips().then((items) => (trips = items)).catch(() => {});
  });

  const tripName = $derived.by(() => {
    if (!tripPath) return '';
    const known = trips.find((t) => contentPath(t['@id']) === tripPath);
    return known ? known.title : tripPath.split('/').pop() ?? tripPath;
  });

  function uploadTail(): string {
    if (!tripPath) return 'pick a trip in the Outbox to upload';
    return navigator.onLine ? 'uploading now' : 'uploads when you are back online';
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving || !title.trim()) return;
    saving = true;
    error = '';
    try {
      const item = await outbox.enqueue({
        kind: 'note',
        tripPath,
        title: title.trim(),
        text,
        // Notes about an earlier moment: honor the picked time, else "now".
        capturedAt: fromDatetimeLocal(when)
      });
      // GPS arrives late and attaches in the background; the note is safe.
      void currentPosition()
        .then((position) => outbox.amendPosition(item.id, position))
        .catch(() => {});
      setPendingFlash(`Note saved — ${uploadTail()}.`);
      if (navigator.onLine) void outbox.drain();
      await goto('/capture');
    } catch (err) {
      console.error(err);
      saving = false;
      error = "Couldn't save the note — storage on this phone may be full. Free up space and try again.";
    }
  }
</script>

<a class="back" href="/capture">← Capture</a>
<h1>Note</h1>
{#if tripName}
  <p class="filing">Filing to <strong>{tripName}</strong></p>
{:else}
  <p class="filing">
    No trip picked yet — this note stays safe in the
    <a href="/outbox">Outbox</a> until you assign one.
  </p>
{/if}

<form onsubmit={save}>
  <label class="field">
    <span>Title <em class="required">required</em></span>
    <input bind:value={title} required />
  </label>
  <label class="field">
    Note
    <textarea placeholder="What just happened?" rows="4" bind:value={text}></textarea>
  </label>
  <label class="field">
    When
    <input type="datetime-local" bind:value={when} />
  </label>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <button disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
</form>

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
  .back:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .filing {
    margin: 0 0 1.4rem;
    color: #42555b;
    font-size: 0.9rem;
  }
  .filing a {
    color: var(--primary);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-width: 28rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: #42555b;
  }
  .required {
    font-style: normal;
    font-size: 0.75rem;
    color: #5a6676;
  }
  input,
  textarea,
  button {
    font: inherit;
    color: #1c2430;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    min-height: 2.75rem;
  }
  input,
  textarea {
    padding: 0.5rem;
  }
  textarea {
    resize: vertical;
  }
  ::placeholder {
    color: #5a6676;
    opacity: 1;
  }
  button {
    background: var(--primary);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background-color 150ms ease-out;
  }
  button:hover:not(:disabled) {
    background: var(--primary-soft);
  }
  button:disabled {
    opacity: 0.7;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .error {
    color: #b3261e;
    margin: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
