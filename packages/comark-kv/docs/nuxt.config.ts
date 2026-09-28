import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  compatibilityDate: '2025-07-15',
  site: {
    name: 'comark-kv',
    url: 'https://miguelrk.github.io',
  },
  robots: { robotsTxt: false },
  alias: {
    'comark-kv/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url)),
    'comark-kv/model': fileURLToPath(new URL('../src/model/index.ts', import.meta.url)),
    'comark-kv': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-kv/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/comark-kv',
    title: 'comark-kv',
    description: 'Comark plugin for unstorage-backed key-value state with two-way kv.* model binding.',
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/comark-kv/llms-full.txt'],
  },
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  },
  nitro: {
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
