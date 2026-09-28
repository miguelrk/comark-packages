import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  compatibilityDate: '2025-07-15',
  site: {
    name: 'comark-email',
    url: 'https://miguelrk.github.io',
  },
  robots: { robotsTxt: false },
  alias: {
    'comark-email': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-email/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/comark-email',
    title: 'comark-email',
    description: 'Email renderer for Comark. Convert Markdown to responsive, MJML-compiled HTML for email clients.',
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/comark-email/llms-full.txt'],
  },
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  },
  nitro: {
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
