/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Custom service worker (vite-pwa injectManifest; SvelteKit builds this
 * file, then the plugin injects the precache manifest into the output).
 * Exists instead of the generated worker for a single reason: the Web
 * Share Target POST below — everything else reproduces what generateSW
 * did before.
 */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

import { stashSharedFiles } from './lib/capture/share-store';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

// registerType: 'autoUpdate' — a new worker takes over immediately.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Pure SPA: every navigation serves the precached shell, except backend
// paths that must reach the network (mirrors the old navigateFallback).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/\+\+api\+\+/, /^\/@@/]
  })
);

// Hashed image scales are content-addressed (…/@@images/<field>-<width>-
// <hash>.<ext>), so cache-first is safe indefinitely: the hash changes
// when the image does. Matching on pathname shape covers both the
// same-origin /++api++ proxy and an absolute VITE_API_BASE origin —
// cross-origin responses only land here when the <img> carries
// crossorigin="anonymous" and the backend allows the app's origin
// (see lib/api/base.ts); opaque responses fail the statuses check.
registerRoute(
  ({ url }) => /\/@@images\/[^/]+-\d+-[0-9a-f]+\.\w+$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'plone-image-scales',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [200] })
    ]
  })
);

// Web Share Target (manifest share_target): Android delivers shared media
// as a multipart POST to /capture/share. Static hosting has no server to
// answer it — stash the files and 303 to the same path, where the page
// takes them and stages them into the outbox. The files must be safe in
// IndexedDB before the redirect: Android may tear the share activity down
// as soon as the response arrives.
registerRoute(
  ({ url }) => url.pathname === '/capture/share',
  async ({ request }) => {
    try {
      const formData = await request.formData();
      const files = formData
        .getAll('media')
        .filter((entry): entry is File => entry instanceof File);
      await stashSharedFiles(files);
    } catch {
      // Malformed share: redirect anyway; the page finds nothing stashed
      // and lands on /capture instead of a broken POST error page.
    }
    return Response.redirect('/capture/share', 303);
  },
  'POST'
);
