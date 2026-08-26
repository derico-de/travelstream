import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      // Custom service worker (src/service-worker.ts, SvelteKit's own
      // convention — the plugin injects the precache manifest into Kit's
      // built worker): precache + SPA fallback + the image-scale cache
      // live there now, because receiving files from the Android share
      // sheet (Web Share Target level 2) needs a POST fetch handler that
      // generateSW cannot express.
      strategies: 'injectManifest',
      // Pure SPA: +layout.ts sets `prerender = false`, so the static adapter
      // only emits the fallback shell. `spa` puts that shell (build/index.html,
      // written after this plugin runs) into the precache manifest with a
      // revision taken from _app/version.json - without it navigateFallback
      // points at a URL workbox never precached and the whole SW throws
      // "non-precached-url" on registration.
      kit: {
        adapterFallback: 'index.html',
        spa: true
      },
      manifest: {
        name: 'Travelstream',
        short_name: 'Travelstream',
        description: 'Offline-first travel capture and curation client',
        theme_color: '#0e5f6d',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ],
        // Lists the app in Android's share sheet (installed WebAPKs only).
        // The share arrives as a POST that src/sw.ts intercepts and hands
        // to /capture/share; changing action/params requires Chrome to
        // re-mint the WebAPK (reinstall to see it immediately).
        share_target: {
          action: '/capture/share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'media', accept: ['image/*', 'video/*'] }]
          }
        }
      },
      injectManifest: {
        // Globs run against .svelte-kit/output, which only ever holds client/
        // and server/ here. Scope them to client/ ourselves and set an empty
        // modifyURLPrefix: that flag is what makes @vite-pwa/sveltekit leave
        // globPatterns alone instead of appending its own
        // "prerendered/**/*.{html,json}", which matches nothing in an SPA and
        // makes workbox warn on every build. Empty means identity transform,
        // so URLs are untouched.
        globPatterns: ['client/**/*.{js,css,svg,png,woff2,webmanifest}'],
        modifyURLPrefix: {}
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 8085,
    // Tailscale MagicDNS names ("powerman" short form and *.ts.net full form).
    allowedHosts: ['powerman', '.ts.net'],
    proxy: {
      '/++api++': {
        target: process.env.PLONE_API || 'http://localhost:8080/Plone',
        changeOrigin: true,
        // Zope VirtualHostMonster rewrite, mirroring the production nginx
        // proxy: without it the backend answers with physical-path URLs
        // (http://localhost:8080/Plone/++api++/...) that bypass this proxy
        // and 404 - which breaks TUS uploads and every Location header.
        configure(proxy, options) {
          const backend = new URL(String(options.target));
          const siteId = backend.pathname.replace(/^\/+|\/+$/g, '') || 'Plone';
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers.host ?? 'localhost:8085';
            const proto = req.headers['x-forwarded-proto'] ?? 'http';
            // Same incantation as deploy/nginx.conf: ++api++ sits inside
            // the physical path, before VirtualHostRoot.
            const suffix = (req.url ?? '').replace(/^(\/\+\+api\+\+)+/, '');
            proxyReq.path =
              `/VirtualHostBase/${proto}/${host}/${siteId}/++api++/VirtualHostRoot${suffix}`;
          });
        }
      }
    }
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node'
  }
});
