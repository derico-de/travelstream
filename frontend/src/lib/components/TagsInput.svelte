<script lang="ts">
  /**
   * Tag (Plone keyword) editor: chips + a suggestion dropdown fed by the
   * site's existing keywords. New tags can only be typed in when the
   * backend says the user's roles allow it (canCreate) — the same rule
   * Plone's own keywords widget applies.
   */
  let {
    value = $bindable<string[]>([]),
    suggestions = [],
    canCreate = false
  }: {
    value?: string[];
    suggestions?: string[];
    canCreate?: boolean;
  } = $props();

  let input = $state('');
  let focused = $state(false);

  const filtered = $derived(
    suggestions
      .filter((s) => !value.includes(s))
      .filter((s) => !input.trim() || s.toLowerCase().includes(input.trim().toLowerCase()))
      .slice(0, 8)
  );

  /* Typed text that isn't an existing keyword gets an explicit "Add" row —
     Enter/comma also commit, but an invisible-only affordance reads as
     "new tags are not possible". */
  const showCreate = $derived.by(() => {
    const clean = input.trim();
    if (!canCreate || !clean || value.includes(clean)) return false;
    return !filtered.some((s) => s.toLowerCase() === clean.toLowerCase());
  });

  function add(tag: string) {
    const clean = tag.trim();
    if (!clean || value.includes(clean)) return;
    if (!canCreate && !suggestions.includes(clean)) return;
    value = [...value, clean];
    input = '';
  }

  function remove(tag: string) {
    value = value.filter((t) => t !== tag);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (input.trim()) add(canCreate ? input : (filtered[0] ?? input));
    } else if (event.key === 'Backspace' && !input && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }
</script>

<div class="tags">
  <div class="chips">
    {#each value as tag (tag)}
      <span class="chip">
        {tag}
        <button
          type="button"
          class="chip-remove"
          aria-label={`Remove tag ${tag}`}
          onclick={() => remove(tag)}>×</button
        >
      </span>
    {/each}
    <input
      bind:value={input}
      onkeydown={onKeydown}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      placeholder={value.length === 0
        ? canCreate
          ? 'Add a tag…'
          : 'Pick a tag…'
        : ''}
      aria-label="Add tag"
    />
  </div>
  {#if focused && (filtered.length > 0 || showCreate)}
    <ul class="suggestions">
      {#if showCreate}
        <li>
          <!-- mousedown, not click: keep focus (and the dropdown) alive -->
          <button
            type="button"
            class="create"
            onmousedown={(event) => {
              event.preventDefault();
              add(input);
            }}>＋ Add “{input.trim()}”</button
          >
        </li>
      {/if}
      {#each filtered as suggestion (suggestion)}
        <li>
          <!-- mousedown, not click: keep focus (and the dropdown) alive -->
          <button
            type="button"
            onmousedown={(event) => {
              event.preventDefault();
              add(suggestion);
            }}>{suggestion}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  {#if focused && !canCreate && input.trim() && filtered.length === 0}
    <p class="hint">Only existing tags can be used.</p>
  {/if}
</div>

<style>
  .tags {
    position: relative;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid #b8c0cc;
    border-radius: 6px;
    background: white;
  }
  .chips:focus-within {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.3rem 0.15rem 0.6rem;
    border-radius: 999px;
    background: var(--primary-tint);
    color: var(--primary);
    font-size: 0.85rem;
  }
  .chip-remove {
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 1rem;
    line-height: 1;
    padding: 0.1rem 0.3rem;
    cursor: pointer;
    border-radius: 999px;
  }
  .chip-remove:hover {
    background: var(--primary-tint-active, #d4e5e8);
  }
  .chips input {
    flex: 1;
    min-width: 7rem;
    border: none;
    padding: 0.2rem;
    font: inherit;
    background: transparent;
  }
  .chips input:focus {
    outline: none;
  }
  .suggestions {
    position: absolute;
    z-index: 20;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0.25rem;
    list-style: none;
    background: white;
    border: 1px solid #b8c0cc;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(20, 30, 40, 0.15);
    max-height: 12rem;
    overflow-y: auto;
  }
  .suggestions button {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    font: inherit;
    padding: 0.45rem 0.6rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .suggestions button:hover {
    background: var(--primary-tint-hover, #ecf3f4);
  }
  .suggestions .create {
    color: var(--primary);
    font-weight: 600;
  }
  .hint {
    margin: 0.3rem 0 0;
    color: #5a6676;
    font-size: 0.8rem;
  }
</style>
