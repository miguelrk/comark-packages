import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  alias: {
    'comark-fetch': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  runtimeConfig: {
    public: {
      siteUrl: 'https://miguelrk.github.io/comark-fetch',
    },
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-fetch/',
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
      ignore: ['/LICENSE', '/comark-fetch/LICENSE'],
    },
  },
  vite: {
    server: {
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    },
  },
})
