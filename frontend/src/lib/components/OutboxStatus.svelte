<script lang="ts">
  import { page } from '$app/stores';
  import { online, outboxItems } from '$lib/outbox';

  const pending = $derived($outboxItems.filter((i) => i.state !== 'done'));
  const failed = $derived(pending.filter((i) => i.state === 'failed'));

  type Status = 'synced' | 'pending' | 'offline' | 'failed';
  const status = $derived<Status>(
    !$online ? 'offline' : failed.length > 0 ? 'failed' : pending.length > 0 ? 'pending' : 'synced'
  );

  const label = $derived(
    {
      synced: 'Connected — everything synced',
      pending: `Connected — ${pending.length} waiting to upload`,
      offline: `Offline — captures stay queued${pending.length ? ` (${pending.length} waiting)` : ''}`,
      failed: `${failed.length} upload${failed.length === 1 ? '' : 's'} failed — tap to review`
    }[status]
  );
</script>

<a
  class="outbox-status {status}"
  href="/outbox"
  title={label}
  aria-label={label}
  aria-current={$page.url.pathname.startsWith('/outbox') ? 'page' : undefined}
>
  <span class="dot" aria-hidden="true">
    {#if status !== 'synced' && pending.length > 0}{pending.length}{/if}
  </span>
</a>

<style>
  .outbox-status {
    position: relative;
    display: grid;
    place-items: center;
    width: 2.75rem;
    min-height: 2.75rem;
    border-radius: 8px;
    text-decoration: none;
    transition: background-color 150ms ease-out;
  }
  .outbox-status:hover,
  .outbox-status[aria-current='page'] {
    background: rgba(255, 255, 255, 0.12);
  }
  .outbox-status:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }
  .dot {
    min-width: 1.1rem;
    height: 1.1rem;
    box-sizing: border-box;
    padding: 0 0.2rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    display: grid;
    place-items: center;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    color: #10151c;
  }
  .synced .dot {
    background: #3fbf5a;
  }
  .pending .dot {
    background: #f0c24b;
  }
  .offline .dot {
    background: #9fb3b8;
  }
  .failed .dot {
    background: #e05a50;
    color: white;
  }
  @media (prefers-reduced-motion: reduce) {
    .outbox-status {
      transition: none;
    }
  }
</style>
