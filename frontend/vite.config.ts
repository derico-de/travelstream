import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

// Keep in step with src/lib/api/base.ts: same default, same env var.
const apiBase = (process.env.VITE_API_BASE || '/++api++').replace(/\/+$/, '');
const apiIsAbsolute = /^https?:\/\//.test(apiBase);

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Hashed image scales are content-addressed, so cache-first is safe.
// Workbox only honours a RegExp against a cross-origin URL when the match
// starts at index 0, so anchor the pattern at the origin whenever the API
// is absolute — an unanchored pattern would silently never match and
// offline photos would quietly stop working.
const imageScalePattern = new RegExp(
  `${apiIsAbsolute ? '^' : ''}${escapeRe(apiBase)}/.*/@@images/[^/]+-\\d+-[0-9a-f]+\\.\\w+$`
);

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
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
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/\+\+api\+\+/, /^\/@@/],
        runtimeCaching: [
          {
            // The hash changes when the image does, so cache-first is safe
            // indefinitely. Cross-origin responses only reach this cache
            // when the <img> carries crossorigin="anonymous" and the
            // backend allows the app's origin (see lib/api/base.ts).
            urlPattern: imageScalePattern,
            handler: 'CacheFirst',
            options: {
              cacheName: 'plone-image-scales',
              expiration: { maxEntries: 500, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
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
