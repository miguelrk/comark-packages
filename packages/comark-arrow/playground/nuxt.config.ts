import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  alias: {
    'comark-arrow/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url)),
    'comark-arrow': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  runtimeConfig: {
    public: {
      siteUrl: 'https://miguelrk.github.io/comark-packages/comark-arrow',
    },
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-arrow/',
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'color-scheme', content: 'light dark' }],
      link: [{ rel: 'icon', href: 'data:,' }],
    },
  },
  nitro: {
    prerender: {
      routes: ['/'],
      crawlLinks: true,
      ignore: ['/LICENSE', '/comark-packages/comark-arrow/LICENSE'],
    },
  },
  vite: {
    server: {
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    },
    // @arrow-js/sandbox ships as TypeScript sources that do `import ts from
    // 'typescript'`. Pre-bundle typescript (CJS) so Vite synthesizes a default
    // export; excluding the sandbox forces a raw ESM load that breaks.
    optimizeDeps: {
      include: [
        'typescript',
        '@arrow-js/sandbox',
        '@arrow-js/sandbox > typescript',
        'quickjs-emscripten',
      ],
    },
  },
})
