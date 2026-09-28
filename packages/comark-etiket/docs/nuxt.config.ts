import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  compatibilityDate: '2025-07-15',
  site: {
    name: 'comark-etiket',
    url: 'https://miguelrk.github.io',
  },
  robots: { robotsTxt: false },
  alias: {
    'comark-etiket': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-etiket/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/comark-etiket',
    title: 'comark-etiket',
    description: 'Comark plugin to render barcode and QR codes to inline SVG (or PNG) at parse time with etiket.',
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/comark-etiket/llms-full.txt'],
  },
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  },
  nitro: {
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
