<script lang="ts">
  import { Editor } from '@tiptap/core';
  import { travelExtensions } from '@travelstream/tiptap-schema';

  import { api } from '$lib/session';
  import { contentPath } from '$lib/format';
  import type { PublishResponse } from '$lib/api/types';
  import TimelinePicker from './TimelinePicker.svelte';

  let { path }: { path: string } = $props();

  interface Article {
    '@id': string;
    title: string;
    review_state: string | null;
    prosemirror_doc: object | null;
    parent?: { '@id': string };
  }

  let article = $state<Article | null>(null);
  let editorElement = $state<HTMLElement | null>(null);
  let editor = $state<Editor | null>(null);
  let pickerOpen = $state(false);
  let flash = $state('');
  let error = $state('');
  let saving = $state(false);
  let publishResult = $state<PublishResponse | null>(null);
  // Bumped on every editor transaction so toolbar active states refresh.
  let editorTick = $state(0);

  $effect(() => {
    api
      .get<Article>(`/${path}`)
      .then((data) => (article = data))
      .catch(() => (error = 'Could not load the article.'));
  });

  $effect(() => {
    if (!editorElement || !article) return;
    const instance = new Editor({
      element: editorElement,
      extensions: travelExtensions,
      content: article.prosemirror_doc ?? { type: 'doc', content: [] },
      onTransaction: () => {
        editorTick += 1;
      }
    });
    editor = instance;
    return () => instance.destroy();
  });

  /** UIDs of every embedded travel entry in the document (for relations). */
  function embeddedUids(doc: object): string[] {
    const uids = new Set<string>();
    const walk = (node: Record<string, unknown>) => {
      if (node.type === 'travelImage' || node.type === 'travelVideo') {
        const attrs = node.attrs as { uid?: string } | undefined;
        if (attrs?.uid) uids.add(attrs.uid);
      }
      for (const child of (node.content as Record<string, unknown>[]) ?? []) walk(child);
    };
    walk(doc as Record<string, unknown>);
    return [...uids];
  }

  async function save() {
    if (!editor || !article) return;
    saving = true;
    flash = '';
    try {
      const doc = editor.getJSON();
      // Only the ProseMirror JSON is written - no HTML anywhere.
      await api.patch(article['@id'], {
        prosemirror_doc: doc,
        embedded_entries: embeddedUids(doc)
      });
      flash = 'Saved.';
    } catch {
      flash = 'Saving failed.';
    } finally {
      saving = false;
    }
  }

  async function publish(transition: 'publish' | 'retract') {
    if (!article) return;
    await save();
    try {
      publishResult = await api.publish(article['@id'], transition);
      const refreshed = await api.get<Article>(`/${path}`);
      article = refreshed;
    } catch {
      flash = `${transition} failed.`;
    }
  }

  function insertEmbed(item: import('$lib/api/types').TimelineItem) {
    if (!editor) return;
    const node =
      item.kind === 'video'
        ? { type: 'travelVideo', attrs: { uid: item.UID, caption: item.title } }
        : {
            type: 'travelImage',
            attrs: { uid: item.UID, scale: 'large', alt: item.title, caption: null }
          };
    editor.chain().focus().insertContent(node).run();
    pickerOpen = false;
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL', previous ?? 'https://');
    if (href === null) return;
    if (href === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href }).run();
    }
  }

  const tripPath = $derived(
    article?.parent ? contentPath(article.parent['@id']) : path.split('/').slice(0, -1).join('/')
  );
</script>

{#if error}
  <p class="error">{error}</p>
{:else if !article}
  <p>Loading article...</p>
{:else}
  <div class="editor-page">
    <div class="header">
      <h1>{article.title}</h1>
      <span class="state">{article.review_state}</span>
    </div>

    {#if editor}
      {#key editorTick}
        <div class="toolbar">
          <button
            class:on={editor.isActive('bold')}
            onclick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button
          >
          <button
            class:on={editor.isActive('italic')}
            onclick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button
          >
          <button
            class:on={editor.isActive('heading', { level: 2 })}
            onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >H2</button
          >
          <button
            class:on={editor.isActive('heading', { level: 3 })}
            onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            >H3</button
          >
          <button
            class:on={editor.isActive('bulletList')}
            onclick={() => editor?.chain().focus().toggleBulletList().run()}>••</button
          >
          <button
            class:on={editor.isActive('orderedList')}
            onclick={() => editor?.chain().focus().toggleOrderedList().run()}>1.</button
          >
          <button
            class:on={editor.isActive('blockquote')}
            onclick={() => editor?.chain().focus().toggleBlockquote().run()}>❝</button
          >
          <button class:on={editor.isActive('link')} onclick={setLink}>🔗</button>
          <button onclick={() => (pickerOpen = true)}>📷 Embed</button>
        </div>
      {/key}
    {/if}

    <div class="surface" bind:this={editorElement}></div>

    <div class="actions">
      <button class="primary" disabled={saving} onclick={() => save()}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      {#if article.review_state === 'published'}
        <button onclick={() => publish('retract')}>Retract</button>
      {:else}
        <button onclick={() => publish('publish')}>Publish</button>
      {/if}
      {#if flash}<span class="flash">{flash}</span>{/if}
    </div>

    {#if publishResult}
      <ul class="publish-result">
        {#each publishResult.items as item (item.uid)}
          <li>
            {item.title}: {item.status}
            {#if item.message}({item.message}){/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if pickerOpen}
    <TimelinePicker
      path={tripPath}
      onpick={insertEmbed}
      onclose={() => (pickerOpen = false)}
    />
  {/if}
{/if}

<style>
  .header {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
  }
  .state { color: #5a6676; font-size: 0.85rem; }
  .toolbar {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    position: sticky;
    top: 3rem;
    background: #f5f6f8;
    padding: 0.4rem 0;
    z-index: 5;
  }
  .toolbar button {
    font: inherit;
    min-width: 2.2rem;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    background: white;
    cursor: pointer;
  }
  .toolbar button.on { background: #1a3c5e; color: white; }
  .surface {
    background: white;
    border-radius: 10px;
    padding: 1rem;
    min-height: 40dvh;
    box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12);
  }
  .surface :global(.ProseMirror) { outline: none; min-height: 38dvh; }
  .surface :global(figure) { margin: 1rem 0; }
  .surface :global(figure img), .surface :global(figure video) {
    max-width: 100%;
    border-radius: 6px;
  }
  .actions {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    margin-top: 0.8rem;
  }
  .actions button {
    font: inherit;
    padding: 0.5rem 1.3rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
    background: white;
    cursor: pointer;
  }
  .actions .primary { background: #1a3c5e; color: white; border: none; }
  .flash { color: #14691b; }
  .publish-result { color: #5a6676; font-size: 0.85rem; }
  .error { color: #b3261e; }
</style>
