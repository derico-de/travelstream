<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authenticated, keepSessionFresh, logout } from '$lib/session';

  let { children } = $props();

  onMount(() => {
    keepSessionFresh();
    if (!$authenticated && $page.url.pathname !== '/login') {
      goto('/login');
    }
  });
</script>

<svelte:head>
  <title>Travelstream</title>
</svelte:head>

<div class="app">
  {#if $authenticated}
    <header class="topbar">
      <a href="/" class="brand">Travelstream</a>
      <nav>
        <a href="/outbox">Outbox</a>
        <button class="linklike" onclick={() => logout()}>Log out</button>
      </nav>
    </header>
  {/if}
  <main>
    {@render children()}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
    background: #f5f6f8;
    color: #1c2430;
  }
  .app {
    max-width: 46rem;
    margin: 0 auto;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 1rem;
    background: #1a3c5e;
    color: white;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .topbar a, .topbar .linklike {
    color: white;
    text-decoration: none;
    margin-left: 0.75rem;
  }
  .brand {
    font-weight: 700;
    margin-left: 0 !important;
  }
  .linklike {
    background: none;
    border: none;
    font: inherit;
    cursor: pointer;
    padding: 0;
  }
  main {
    flex: 1;
    padding: 1rem;
  }
</style>
