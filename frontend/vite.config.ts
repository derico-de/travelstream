import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

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
            // Hashed image scales are content-addressed (the hash changes
            // when the image does), so cache-first is safe indefinitely.
            urlPattern: /\/\+\+api\+\+\/.*\/@@images\/[^/]+-\d+-[0-9a-f]+\.\w+$/,
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
    proxy: {
      '/++api++': {
        target: process.env.PLONE_API || 'http://localhost:8080/Plone',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node'
  }
});
