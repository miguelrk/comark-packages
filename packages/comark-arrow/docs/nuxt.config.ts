import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  compatibilityDate: '2025-07-15',
  site: {
    name: 'comark-arrow',
    url: 'https://miguelrk.github.io',
  },
  robots: { robotsTxt: false },
  alias: {
    'comark-arrow/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url)),
    'comark-arrow/html': fileURLToPath(new URL('../src/html.ts', import.meta.url)),
    'comark-arrow': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-arrow/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/comark-arrow',
    title: 'comark-arrow',
    description: 'Comark plugin for ArrowJS sandboxed widgets — agent-authored UI with no upfront component registration.',
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/comark-arrow/llms-full.txt'],
  },
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
    optimizeDeps: {
      include: ['typescript', '@arrow-js/sandbox', '@arrow-js/sandbox > typescript', 'quickjs-emscripten'],
    },
  },
  nitro: {
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
