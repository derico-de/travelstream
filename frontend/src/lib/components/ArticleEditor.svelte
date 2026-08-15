<script lang="ts">
  import { Editor } from '@tiptap/core';
  import { goto } from '$app/navigation';

  import { api } from '$lib/session';
  import { MEDIA_CROSSORIGIN } from '$lib/api/base';
  import {
    contentPath,
    coverUrl,
    fromDatetimeLocal,
    readImagePayload,
    toDatetimeLocal
  } from '$lib/format';
  import type { ImageFieldScales, PublishResponse } from '$lib/api/types';
  import TagsInput from './TagsInput.svelte';
  import TimelinePicker from './TimelinePicker.svelte';
  import { editorExtensions } from './editorExtensions';
  import type { GalleryItemRef, GalleryPlacement } from './gallery';

  let { path }: { path: string } = $props();

  interface Article {
    '@id': string;
    title: string;
    description: string | null;
    subjects?: string[];
    review_state: string | null;
    prosemirror_doc: object | null;
    captured_at?: string | null;
    image?: ImageFieldScales | null;
    parent?: { '@id': string };
  }

  let article = $state<Article | null>(null);
  let editorElement = $state<HTMLElement | null>(null);
  let editor = $state<Editor | null>(null);
  // 'embed' = legacy single pick; 'gallery' = new multi-select insert;
  // 'gallery-edit' = reopen with the selected gallery's items.
  let picker = $state<'closed' | 'embed' | 'gallery' | 'gallery-edit'>('closed');
  let flash = $state('');
  let error = $state('');
  let saving = $state(false);
  let publishResult = $state<PublishResponse | null>(null);
  // Snapshot of toolbar active states, refreshed per transaction. Never
  // rebuild the toolbar DOM for this ({#key} would swap the buttons
  // between mousedown and mouseup, eating every first click).
  let active = $state({
    bold: false,
    italic: false,
    h2: false,
    h3: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    link: false,
    gallery: false,
    canUndo: false,
    canRedo: false
  });

  let capturedAt = $state('');
  let title = $state('');
  let description = $state('');
  let subjects = $state<string[]>([]);
  let keywordSuggestions = $state<string[]>([]);
  // Seeded from the last fetched settings; permissive when nothing is known
  // yet, so a failed fetch never locks tag creation for an allowed user.
  let canAddKeywords = $state(api.settingsCached()?.can_add_keywords ?? true);
  // Cover changes are staged locally and written on Save, like the rest.
  let coverPreview = $state<string | null>(null);
  let coverFile = $state<File | null>(null);
  let coverRemoved = $state(false);

  $effect(() => {
    api
      .get<Article>(`/${path}`)
      .then((data) => {
        article = data;
        title = data.title;
        description = data.description ?? '';
        subjects = data.subjects ?? [];
        capturedAt = toDatetimeLocal(data.captured_at);
      })
      .catch(() => (error = 'Could not load the article.'));
  });

  $effect(() => {
    api.keywords().then((items) => (keywordSuggestions = items)).catch(() => {});
    api.settings().then((s) => (canAddKeywords = s.can_add_keywords)).catch(() => {});
  });

  const coverSrc = $derived(
    coverPreview ?? (coverRemoved || !article ? null : coverUrl(article))
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

  $effect(() => {
    if (!editorElement || !article) return;
    const instance = new Editor({
      element: editorElement,
      extensions: editorExtensions,
      content: article.prosemirror_doc ?? { type: 'doc', content: [] },
      onTransaction: ({ editor: e }) => {
        active = {
          bold: e.isActive('bold'),
          italic: e.isActive('italic'),
          h2: e.isActive('heading', { level: 2 }),
          h3: e.isActive('heading', { level: 3 }),
          bulletList: e.isActive('bulletList'),
          orderedList: e.isActive('orderedList'),
          blockquote: e.isActive('blockquote'),
          link: e.isActive('link'),
          gallery: e.isActive('travelGallery'),
          canUndo: e.can().undo(),
          canRedo: e.can().redo()
        };
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
      if (node.type === 'travelGallery') {
        const attrs = node.attrs as { items?: { uid?: string }[] } | undefined;
        for (const item of attrs?.items ?? []) {
          if (item?.uid) uids.add(item.uid);
        }
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
      // An emptied title falls back to the last saved one - articles
      // always keep a name.
      const newTitle = title.trim() || article.title;
      // Only the ProseMirror JSON is written - no HTML anywhere.
      const payload: Record<string, unknown> = {
        title: newTitle,
        description: description.trim(),
        subjects,
        prosemirror_doc: doc,
        embedded_entries: embeddedUids(doc),
        // Timeline placement; cleared falls back to the creation time.
        captured_at: fromDatetimeLocal(capturedAt) ?? null
      };
      if (coverFile) payload.image = await readImagePayload(coverFile);
      else if (coverRemoved) payload.image = null;
      await api.patch(article['@id'], payload);
      if (coverFile || coverRemoved) {
        // Re-read the stored image (real scales) without replacing the
        // whole article — that would tear down and rebuild the editor.
        const refreshed = await api.get<Article>(`/${path}`);
        article.image = refreshed.image;
        coverFile = null;
        coverRemoved = false;
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        coverPreview = null;
      }
      article.title = newTitle;
      title = newTitle;
      article.description = description.trim();
      flash = 'Saved.';
    } catch {
      flash = 'Saving failed.';
    } finally {
      saving = false;
    }
  }

  async function deleteArticle() {
    if (!article) return;
    const sure = window.confirm(
      'Delete this article? Embedded photos and videos stay in the trip.'
    );
    if (!sure) return;
    try {
      await api.delete(article['@id']);
      goto(`/t/${tripPath}`);
    } catch {
      flash = 'Deleting failed.';
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
    picker = 'closed';
  }

  /** Items of the currently selected gallery node (for gallery-edit mode). */
  function selectedGalleryItems(): GalleryItemRef[] {
    return (editor?.getAttributes('travelGallery').items as GalleryItemRef[]) ?? [];
  }

  function handleGalleryConfirm(items: GalleryItemRef[], placement: GalleryPlacement) {
    if (!editor) return;
    if (picker === 'gallery-edit') {
      if (items.length === 0) {
        // Everything deselected: the gallery block goes; media stays in the trip.
        editor.chain().focus().deleteSelection().run();
      } else {
        editor.chain().focus().updateAttributes('travelGallery', { items }).run();
      }
    } else {
      const node = { type: 'travelGallery', attrs: { items } };
      if (placement === 'cursor') {
        editor.chain().focus().insertContent(node).scrollIntoView().run();
      } else {
        // Select the inserted node so the toolbar immediately offers
        // "Edit gallery", then bring it into view once the picker is gone
        // (PM's own scrollIntoView doesn't reach the window here).
        const pos = placement === 'top' ? 0 : editor.state.doc.content.size;
        editor.chain().focus().insertContentAt(pos, node).setNodeSelection(pos).run();
        requestAnimationFrame(() => {
          const dom = editor?.view.nodeDOM(pos);
          if (dom instanceof HTMLElement) {
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            dom.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
          }
        });
      }
    }
    picker = 'closed';
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
    <a class="back" href={`/t/${tripPath}`}>← Trip</a>
    <div class="header">
      <input
        class="title"
        aria-label="Article title"
        placeholder="Untitled"
        bind:value={title}
      />
      <span class="state">{article.review_state}</span>
    </div>

    <div class="cover">
      {#if coverSrc}
        <img src={coverSrc} alt="Article cover" crossorigin={MEDIA_CROSSORIGIN} />
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

    <textarea
      class="description"
      aria-label="Article description"
      placeholder="Short description — shown in the article list and as the blog teaser"
      rows="2"
      bind:value={description}
    ></textarea>

    <label class="captured">
      Captured at
      <input type="datetime-local" bind:value={capturedAt} />
    </label>

    <div class="article-tags">
      <TagsInput
        bind:value={subjects}
        suggestions={keywordSuggestions}
        canCreate={canAddKeywords}
      />
    </div>

    {#if editor}
      <!-- preventDefault on mousedown keeps focus (and the selection) in
           the editor while a toolbar button is pressed. -->
      <div
        class="toolbar"
        role="toolbar"
        tabindex="-1"
        onmousedown={(event) => event.preventDefault()}
      >
        <button
          aria-label="Undo"
          disabled={!active.canUndo}
          onclick={() => editor?.chain().focus().undo().run()}>↶</button
        >
        <button
          aria-label="Redo"
          disabled={!active.canRedo}
          onclick={() => editor?.chain().focus().redo().run()}>↷</button
        >
        <button
          class:on={active.bold}
          onclick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button
        >
        <button
          class:on={active.italic}
          onclick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button
        >
        <button
          class:on={active.h2}
          onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >H2</button
        >
        <button
          class:on={active.h3}
          onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          >H3</button
        >
        <button
          class:on={active.bulletList}
          onclick={() => editor?.chain().focus().toggleBulletList().run()}>••</button
        >
        <button
          class:on={active.orderedList}
          onclick={() => editor?.chain().focus().toggleOrderedList().run()}>1.</button
        >
        <button
          class:on={active.blockquote}
          onclick={() => editor?.chain().focus().toggleBlockquote().run()}>❝</button
        >
        <button class:on={active.link} onclick={setLink}>🔗</button>
        <button onclick={() => (picker = 'embed')}>📷 Embed</button>
        {#if active.gallery}
          <button class="on" onclick={() => (picker = 'gallery-edit')}>🖼 Edit gallery</button>
        {:else}
          <button onclick={() => (picker = 'gallery')}>🖼 Gallery</button>
        {/if}
      </div>
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
      <button class="danger" onclick={deleteArticle}>Delete</button>
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

  {#if picker === 'embed'}
    <TimelinePicker
      path={tripPath}
      onpick={insertEmbed}
      onclose={() => (picker = 'closed')}
    />
  {:else if picker === 'gallery' || picker === 'gallery-edit'}
    <TimelinePicker
      path={tripPath}
      multiple
      editing={picker === 'gallery-edit'}
      initial={picker === 'gallery-edit' ? selectedGalleryItems() : []}
      onconfirm={handleGalleryConfirm}
      onclose={() => (picker = 'closed')}
    />
  {/if}
{/if}

<style>
  .back {
    display: inline-block;
    margin-bottom: 0.5rem;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    background: #e4e8ee;
    color: #1c2430;
    text-decoration: none;
    font-size: 0.9rem;
  }
  .cover {
    margin-bottom: 0.6rem;
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
  /* Same in-place treatment as the title: page-colored until touched. */
  .description {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin: 0 0 0.6rem;
    padding: 0.1rem 0;
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.4;
    color: #5a6676;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    resize: vertical;
  }
  .description:hover { border-bottom-color: #dbe1e8; }
  .description:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 3px;
    border-radius: 2px;
  }
  .article-tags {
    max-width: 28rem;
    margin-bottom: 0.6rem;
  }
  .captured {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
    font-size: 0.9rem;
    color: #5a6676;
  }
  .captured input {
    font: inherit;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #b8c0cc;
  }
  .header {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    margin: 0 0 0.6rem;
  }
  /* The title edits in place: title typography on the bare page, no
     input chrome until it is hovered or focused. */
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0.1rem 0;
    font-family: inherit;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.2;
    color: #1c2430;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    border-radius: 0;
  }
  .title:hover { border-bottom-color: #dbe1e8; }
  .title:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 3px;
    border-radius: 2px;
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
  .toolbar button.on { background: var(--primary); color: white; }
  .toolbar button:disabled {
    opacity: 0.4;
    cursor: default;
  }
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
  .surface :global(figure.travel-gallery) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 2px;
  }
  .surface :global(.travel-gallery-item) {
    position: relative;
    display: block;
    aspect-ratio: 1;
    overflow: hidden;
    background: #e1eef0;
  }
  .surface :global(.travel-gallery-item img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 0;
  }
  /* Centered Darkroom-tinted play disc: videos must be unmissable among
     photo tiles. */
  .surface :global(.travel-gallery-play) {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(10, 16, 24, 0.55);
    color: white;
    font-size: 0.85rem;
    padding-left: 2px; /* optically center the triangle */
    box-sizing: border-box;
    pointer-events: none;
  }
  .surface :global(.travel-gallery-empty) {
    grid-column: 1 / -1;
    padding: 1rem;
    color: #5a6676;
    font-size: 0.9rem;
    text-align: center;
  }
  .surface :global(.ProseMirror-selectednode) {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
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
  .actions .primary { background: var(--primary); color: white; border: none; }
  .actions .danger {
    margin-left: auto;
    border-color: #b3261e;
    color: #b3261e;
  }
  .flash { color: #14691b; }
  .publish-result { color: #5a6676; font-size: 0.85rem; }
  .error { color: #b3261e; }
</style>
