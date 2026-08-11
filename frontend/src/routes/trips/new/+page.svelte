<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/session';
  import { ApiError } from '$lib/api/client';
  import type { NewTrip } from '$lib/api/types';
  import { contentPath } from '$lib/format';

  let title = $state('');
  let description = $state('');
  let startDate = $state('');
  let endDate = $state('');
  let coverFiles = $state<FileList | null>(null);
  let error = $state('');
  let busy = $state(false);

  async function readCover(file: File): Promise<NewTrip['image']> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return {
      data: dataUrl.split(',', 2)[1] ?? '',
      encoding: 'base64',
      filename: file.name,
      'content-type': file.type || 'application/octet-stream'
    };
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
      const cover = coverFiles?.[0];
      const trip = await api.createTrip({
        title,
        description: description || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        image: cover ? await readCover(cover) : undefined
      });
      goto(`/t/${contentPath(trip['@id'])}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        error = 'You are not allowed to create trips.';
      } else {
        error = 'Could not create the trip - check your connection and try again.';
      }
    } finally {
      busy = false;
    }
  }
</script>

<form class="new-trip" onsubmit={submit}>
  <h1>New trip</h1>
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
  <label>
    Cover image
    <input name="cover" type="file" accept="image/*" bind:files={coverFiles} />
  </label>
  {#if error}<p class="error">{error}</p>{/if}
  <div class="actions">
    <button disabled={busy}>{busy ? 'Creating...' : 'Create trip'}</button>
    <a href="/">Cancel</a>
  </div>
</form>

<style>
  .new-trip {
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
  .actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  button {
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
