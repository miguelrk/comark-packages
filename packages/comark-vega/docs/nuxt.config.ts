import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  compatibilityDate: '2025-07-15',
  site: {
    name: 'comark-vega',
    url: 'https://miguelrk.github.io',
  },
  robots: { robotsTxt: false },
  alias: {
    'comark-vega/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url)),
    'comark-vega': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-vega/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/comark-vega',
    title: 'comark-vega',
    description: 'Comark plugin for Vega and Vega-Lite charts — AST component nodes with a shipped Vue renderer, plus optional parse-time SVG/img for static docs.',
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/comark-vega/llms-full.txt'],
  },
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  },
  nitro: {
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
