import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  alias: {
    'comark-etiket': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  runtimeConfig: {
    public: {
      siteUrl: 'https://miguelrk.github.io/comark-etiket',
    },
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-etiket/',
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
      ignore: ['/LICENSE', '/comark-etiket/LICENSE'],
    },
  },
  vite: {
    server: {
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    },
  },
})
