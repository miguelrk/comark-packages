import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  alias: {
    'comark-email': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    'comark-email/render': fileURLToPath(new URL('../src/render.ts', import.meta.url)),
    'comark-email/config': fileURLToPath(new URL('../src/config.ts', import.meta.url)),
  },
  runtimeConfig: {
    public: {
      siteUrl: 'https://miguelrk.github.io/comark-packages/comark-email',
    },
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-email/',
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'color-scheme', content: 'light dark' }],
      link: [{ rel: 'icon', href: 'data:,' }],
    },
  },
  nitro: {
    alias: {
      'comark-email': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      'comark-email/render': fileURLToPath(new URL('../src/render.ts', import.meta.url)),
      'comark-email/config': fileURLToPath(new URL('../src/config.ts', import.meta.url)),
    },
    prerender: {
      routes: ['/'],
      crawlLinks: true,
      ignore: ['/LICENSE', '/comark-packages/comark-email/LICENSE'],
    },
  },
  vite: {
    server: {
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    },
  },
})
