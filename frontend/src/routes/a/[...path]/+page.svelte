<script lang="ts">
  import { page } from '$app/stores';
  import ArticleEditor from '$lib/components/ArticleEditor.svelte';

  const path = $derived($page.params.path ?? '');
</script>

{#key path}
  <ArticleEditor {path} />
{/key}
