<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api, authenticated, keepSessionFresh, logout } from '$lib/session';
  import { startOutboxDraining } from '$lib/outbox';
  import OutboxStatus from '$lib/components/OutboxStatus.svelte';

  let { children } = $props();

  // Trip context of the current route: /t/<trip>, /trips/edit/<trip>, or
  // the parent of an entry (/e/) or article (/a/) path.
  const tripPath = $derived.by(() => {
    const pathname = decodeURIComponent($page.url.pathname);
    if (pathname.startsWith('/t/')) return pathname.slice(3);
    if (pathname.startsWith('/trips/edit/')) return pathname.slice('/trips/edit/'.length);
    if (pathname.startsWith('/e/') || pathname.startsWith('/a/')) {
      const segments = pathname.slice(3).split('/').filter(Boolean);
      segments.pop();
      return segments.join('/');
    }
    return '';
  });

  const tripTitles = new Map<string, string>();
  let tripTitle = $state('');

  $effect(() => {
    const path = tripPath.replace(/\/$/, '');
    if (!path || path === 'trips') {
      tripTitle = '';
      return;
    }
    const cached = tripTitles.get(path);
    if (cached !== undefined) {
      tripTitle = cached;
      return;
    }
    tripTitle = '';
    api
      .get<{ '@type'?: string; title?: string }>(`/${path}`)
      .then((data) => {
        // Only genuine Trips get their name in the bar (an entry directly
        // under the trips folder would resolve to the folder itself).
        const title = data['@type'] === 'Trip' ? (data.title ?? '') : '';
        tripTitles.set(path, title);
        if (tripPath.replace(/\/$/, '') === path) tripTitle = title;
      })
      .catch(() => {});
  });

  onMount(() => {
    keepSessionFresh();
    startOutboxDraining();
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
      {#if tripTitle}
        <a class="trip-name" href={`/t/${tripPath}`}>{tripTitle}</a>
      {/if}
      <div class="topbar-actions">
        <OutboxStatus />
        <button class="logout" onclick={() => logout()}>Log out</button>
      </div>
    </header>
  {/if}
  <main class:fill={$page.url.pathname.startsWith('/capture')}>
    {@render children()}
  </main>
  {#if $authenticated}
    <nav class="bottom-nav" aria-label="Primary">
      <a
        href="/"
        class="nav-btn"
        aria-current={$page.url.pathname === '/' ||
        $page.url.pathname.startsWith('/t/') ||
        $page.url.pathname.startsWith('/trips')
          ? 'page'
          : undefined}
      >
        <span class="nav-icon" aria-hidden="true">🧳</span>
        <span class="nav-label">Trips</span>
      </a>
      <a
        href="/capture"
        class="nav-btn"
        aria-current={$page.url.pathname.startsWith('/capture') ? 'page' : undefined}
      >
        <span class="nav-icon" aria-hidden="true">📸</span>
        <span class="nav-label">Capture</span>
      </a>
      <a
        href="/maps"
        class="nav-btn"
        aria-current={$page.url.pathname.startsWith('/maps') ? 'page' : undefined}
      >
        <span class="nav-icon" aria-hidden="true">🗺️</span>
        <span class="nav-label">Maps</span>
      </a>
    </nav>
  {/if}
</div>

<style>
  :global(:root) {
    --primary: #0e5f6d;
    --primary-soft: #2f7f8d;
    --primary-tint: #e1eef0;
    --primary-tint-hover: #ecf3f4;
    --primary-tint-active: #d4e5e8;
  }
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
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.35rem 1rem;
    min-height: 3rem;
    box-sizing: border-box;
    background: var(--primary);
  }
  /* Centered over the whole bar, clipped before it can touch the brand
     or the actions on narrow screens. */
  .trip-name {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    max-width: 38%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: white;
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
  }
  .trip-name:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }
  .brand {
    color: white;
    text-decoration: none;
    font-weight: 700;
  }
  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .logout {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 8px;
    color: white;
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    transition: background-color 150ms ease-out;
  }
  .logout:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .logout:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .logout {
      transition: none;
    }
  }
  main {
    flex: 1;
    padding: 1rem;
  }
  /* Capture only: let the page fill the viewport so its action zone can
     bottom-anchor into the thumb arc. Scoped by route because flex layout
     changes margin behavior for every other screen's content. */
  main.fill {
    display: flex;
    flex-direction: column;
  }
  .bottom-nav {
    position: sticky;
    bottom: 0;
    z-index: 10;
    display: flex;
    gap: 0.25rem;
    background: white;
    border-top: 1px solid #dbe1e8;
    padding: 0.3rem 0.4rem;
    padding-bottom: max(0.3rem, env(safe-area-inset-bottom));
  }
  .nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    min-height: 3rem;
    padding: 0.25rem 0;
    border: none;
    border-radius: 10px;
    background: none;
    font: inherit;
    font-size: 0.72rem;
    color: #42555b;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 150ms ease-out, color 150ms ease-out;
  }
  .nav-icon {
    font-size: 1.3rem;
    line-height: 1;
  }
  .nav-btn[aria-current='page'] {
    color: var(--primary);
    font-weight: 600;
    background: var(--primary-tint);
  }
  @media (hover: hover) {
    .nav-btn:hover {
      background: var(--primary-tint-hover);
    }
  }
  .nav-btn:active {
    background: var(--primary-tint-active);
  }
  .nav-btn:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .nav-btn {
      transition: none;
    }
  }
</style>
