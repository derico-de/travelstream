import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    // vite-pwa registers src/service-worker.ts itself (with autoUpdate
    // semantics); SvelteKit's built-in registration would double-register.
    serviceWorker: {
      register: false
    }
  }
};

export default config;
