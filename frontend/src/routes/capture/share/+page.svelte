<script lang="ts">
  import { goto } from '$app/navigation';
  import { recallLastTrip } from '$lib/capture/last-trip';
  import { setPendingFlash } from '$lib/capture/flash';
  import { takeSharedFiles } from '$lib/capture/share-store';
  import { stageMediaFile } from '$lib/capture/stage';

  let error = $state('');

  /**
   * The service worker stashed whatever Android POSTed and redirected
   * here. Stage it all and hand over to the normal review step — shared
   * items file into the remembered trip (or wait in the Outbox for one),
   * exactly like gallery picks on /capture.
   */
  $effect(() => {
    void (async () => {
      const files = await takeSharedFiles().catch(() => []);
      const media = files.filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      );
      if (media.length === 0) {
        await goto('/capture', { replaceState: true });
        return;
      }
      const tripPath = recallLastTrip();
      try {
        for (const file of media) {
          const kind = file.type.startsWith('video/') ? 'video' : 'photo';
          // No GPS backfill: a share usually happens away from where the
          // photo was taken — EXIF (kept) is the only honest position.
          await stageMediaFile(kind, tripPath, file, { attachPosition: false });
        }
        if (media.length < files.length) {
          setPendingFlash('Some shared files were skipped — only photos and videos are supported.');
        }
        await goto('/capture/review', { replaceState: true });
      } catch (e) {
        console.error(e);
        error =
          "Couldn't save the shared files — storage on this phone may be full. Free up space and share again.";
      }
    })();
  });
</script>

<div class="screen">
  {#if error}
    <p class="flash-error" role="alert">{error}</p>
    <a href="/capture">Back to Capture</a>
  {:else}
    <p class="receiving" role="status">Receiving shared media…</p>
  {/if}
</div>

<style>
  .screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  .receiving {
    color: #42555b;
  }
  .flash-error {
    color: #b3261e;
    margin: 0;
    max-width: 28rem;
    text-align: center;
  }
  a {
    color: var(--primary);
  }
</style>
