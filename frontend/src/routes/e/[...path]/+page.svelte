<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/session';
  import TagsInput from '$lib/components/TagsInput.svelte';
  import {
    browseUrl,
    contentPath,
    formatCaptureTime,
    fromDatetimeLocal,
    toDatetimeLocal
  } from '$lib/format';

  interface Entry {
    '@id': string;
    '@type': string;
    title: string;
    description: string;
    text?: string;
    captured_at?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    review_state?: string | null;
    subjects?: string[];
    image?: { download: string; scales: Record<string, { download: string }> };
    file?: { download: string; 'content-type': string };
    parent?: { '@id': string };
  }

  const path = $derived($page.params.path ?? '');

  let entry = $state<Entry | null>(null);
  let title = $state('');
  let description = $state('');
  let noteText = $state('');
  let capturedAt = $state('');
  let subjects = $state<string[]>([]);
  let keywordSuggestions = $state<string[]>([]);
  let canAddKeywords = $state(false);
  let saving = $state(false);
  let flash = $state('');
  let error = $state('');

  $effect(() => {
    api
      .get<Entry>(`/${path}`)
      .then((data) => {
        entry = data;
        title = data.title;
        description = data.description ?? '';
        noteText = data.text ?? '';
        capturedAt = toDatetimeLocal(data.captured_at);
        subjects = data.subjects ?? [];
      })
      .catch(() => (error = 'Could not load this entry.'));
  });

  $effect(() => {
    api.keywords().then((items) => (keywordSuggestions = items)).catch(() => {});
    api.settings().then((s) => (canAddKeywords = s.can_add_keywords)).catch(() => {});
  });

  /** Timeline of the trip this entry lives in. */
  const backHref = $derived.by(() => {
    const parent = entry?.parent?.['@id'];
    const tripPath = parent
      ? contentPath(parent)
      : path.split('/').slice(0, -1).join('/');
    return `/t/${tripPath}`;
  });

  function mediaUrl(): string | null {
    if (!entry) return null;
    if (entry.image) {
      const scale = entry.image.scales?.larger ?? entry.image.scales?.large;
      const download = scale?.download ?? entry.image.download;
      return download.startsWith('http')
        ? browseUrl(download)
        : `${browseUrl(entry['@id'])}/${download}`;
    }
    if (entry.file) {
      // @@display-media, not @@download: attachment disposition
      // suppresses inline playback UI in Firefox.
      return `${browseUrl(entry['@id'])}/@@display-media/file`;
    }
    return null;
  }

  function posterUrl(): string | undefined {
    if (!entry?.image) return undefined;
    return mediaUrl() ?? undefined;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!entry) return;
    saving = true;
    flash = '';
    try {
      const payload: Record<string, unknown> = {
        title,
        description,
        subjects,
        // Cleared field falls back to the upload time (backend policy).
        captured_at: fromDatetimeLocal(capturedAt) ?? null
      };
      if (entry['@type'] === 'Note') payload.text = noteText;
      await api.patch(entry['@id'], payload);
      entry.captured_at = fromDatetimeLocal(capturedAt) ?? null;
      flash = 'Saved.';
    } catch {
      flash = 'Saving failed.';
    } finally {
      saving = false;
    }
  }
</script>

{#if error}
  <p class="error">{error}</p>
{:else if !entry}
  <p>Loading...</p>
{:else}
  <a class="back" href={backHref}>← Trip</a>
  <article>
    {#if entry['@type'] === 'Image'}
      <img class="media" src={mediaUrl()} alt={entry.title} />
    {:else if entry['@type'] === 'File'}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video class="media" controls preload="metadata" src={mediaUrl()}></video>
    {:else if entry['@type'] === 'Note'}
      <div class="note-body">{entry.text}</div>
    {/if}

    <p class="capture-meta">
      {#if entry.captured_at}{formatCaptureTime(entry.captured_at)}{/if}
      {#if entry.latitude != null && entry.longitude != null}
        · {entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}
      {/if}
      {#if entry.review_state}· {entry.review_state}{/if}
    </p>

    <form onsubmit={save}>
      <label>
        Title
        <input bind:value={title} required />
      </label>
      <label>
        Description
        <textarea rows="2" bind:value={description}></textarea>
      </label>
      <label>
        Captured at
        <input type="datetime-local" bind:value={capturedAt} />
      </label>
      <div class="field">
        <span class="field-label">Tags</span>
        <TagsInput
          bind:value={subjects}
          suggestions={keywordSuggestions}
          canCreate={canAddKeywords}
        />
      </div>
      {#if entry['@type'] === 'Note'}
        <label>
          Text
          <textarea rows="5" bind:value={noteText}></textarea>
        </label>
      {/if}
      <button disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      {#if flash}<span class="flash">{flash}</span>{/if}
    </form>
  </article>
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
  .media {
    width: 100%;
    max-height: 60dvh;
    object-fit: contain;
    background: #10151c;
    border-radius: 10px;
  }
  .note-body {
    background: white;
    border-radius: 10px;
    padding: 1rem;
    white-space: pre-wrap;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
  }
  .capture-meta { color: #5a6676; font-size: 0.85rem; }
  form { display: flex; flex-direction: column; gap: 0.7rem; max-width: 28rem; }
  label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; }
  .field-label { font-size: 0.9rem; }
  input, textarea, button {
    font: inherit;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
  }
  button {
    background: var(--primary);
    color: white;
    border: none;
    cursor: pointer;
    align-self: flex-start;
    padding: 0.5rem 1.4rem;
  }
  .flash { color: #14691b; font-size: 0.9rem; }
  .error { color: #b3261e; }
</style>
