<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/session';
  import { coverUrl, readImagePayload } from '$lib/format';
  import type { Trip } from '$lib/api/types';

  const path = $derived($page.params.path ?? '');

  let trip = $state<Trip | null>(null);
  let title = $state('');
  let description = $state('');
  let startDate = $state('');
  let endDate = $state('');
  let coverFile = $state<File | null>(null);
  let coverPreview = $state<string | null>(null);
  let coverRemoved = $state(false);
  let error = $state('');
  let busy = $state(false);

  $effect(() => {
    api
      .get<Trip>(`/${path}`)
      .then((data) => {
        trip = data;
        title = data.title;
        description = data.description ?? '';
        startDate = data.start_date ?? '';
        endDate = data.end_date ?? '';
      })
      .catch(() => (error = 'Could not load the trip.'));
  });

  const coverSrc = $derived(
    coverPreview ?? (coverRemoved || !trip ? null : coverUrl(trip))
  );

  function pickCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    coverFile = file;
    coverRemoved = false;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    coverPreview = URL.createObjectURL(file);
  }

  function removeCover() {
    coverFile = null;
    coverRemoved = true;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    coverPreview = null;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      error = 'The trip start date must be before its end date.';
      return;
    }
    busy = true;
    error = '';
    try {
      const payload: Record<string, unknown> = {
        title: title.trim() || trip?.title,
        description: description.trim(),
        start_date: startDate || null,
        end_date: endDate || null
      };
      if (coverFile) payload.image = await readImagePayload(coverFile);
      else if (coverRemoved) payload.image = null;
      await api.patch(`/${path}`, payload);
      goto(`/t/${path}`);
    } catch {
      error = 'Could not save the trip - check your connection and try again.';
    } finally {
      busy = false;
    }
  }
</script>

{#if error && !trip}
  <p class="error">{error}</p>
{:else if !trip}
  <p>Loading trip...</p>
{:else}
  <form class="edit-trip" onsubmit={submit}>
    <h1>Edit trip</h1>
    <label>
      Title
      <input name="title" bind:value={title} required />
    </label>
    <label>
      Description
      <textarea name="description" bind:value={description} rows="3"></textarea>
    </label>
    <div class="dates">
      <label>
        Start date
        <input name="start_date" type="date" bind:value={startDate} />
      </label>
      <label>
        End date
        <input name="end_date" type="date" bind:value={endDate} />
      </label>
    </div>
    <div class="cover">
      {#if coverSrc}
        <img src={coverSrc} alt="Trip cover" />
      {/if}
      <div class="cover-actions">
        <label class="cover-pick">
          {coverSrc ? 'Change cover' : '＋ Add cover image'}
          <input
            type="file"
            accept="image/*"
            onchange={(e) => pickCover(e.currentTarget.files)}
          />
        </label>
        {#if coverSrc}
          <button class="cover-remove" type="button" onclick={removeCover}>Remove</button>
        {/if}
      </div>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="actions">
      <button disabled={busy}>{busy ? 'Saving...' : 'Save trip'}</button>
      <a href={`/t/${path}`}>Cancel</a>
    </div>
  </form>
{/if}

<style>
  .edit-trip {
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.9rem;
  }
  input,
  textarea {
    padding: 0.55rem;
    border: 1px solid #b8c0cc;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }
  .dates {
    display: flex;
    gap: 0.9rem;
  }
  .dates label {
    flex: 1;
  }
  .cover img {
    display: block;
    width: 100%;
    max-height: 14rem;
    object-fit: cover;
    border-radius: 10px;
    margin-bottom: 0.4rem;
  }
  .cover-actions {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }
  .cover-pick {
    position: relative;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 2.2rem;
    padding: 0.35rem 0.9rem;
    border: 1px dashed var(--primary);
    border-radius: 6px;
    color: var(--primary);
    cursor: pointer;
    font-size: 0.85rem;
  }
  /* Same rule as capture: keep the input in the tab order. */
  .cover-pick input {
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
  .cover-pick:has(input:focus-visible) {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  .cover-remove {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.9rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    background: white;
    color: #b3261e;
    cursor: pointer;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .actions button {
    padding: 0.6rem 1.2rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
  }
  .error {
    color: #b3261e;
    font-size: 0.9rem;
  }
</style>
