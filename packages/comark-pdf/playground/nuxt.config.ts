import { fileURLToPath } from 'node:url'

const comarkPdf = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const comarkPdfPreview = fileURLToPath(new URL('../src/preview.ts', import.meta.url))
const comarkPdfMath = fileURLToPath(new URL('../src/plugins/math.ts', import.meta.url))
const comarkPdfMermaid = fileURLToPath(new URL('../src/plugins/mermaid.ts', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  alias: {
    'comark-pdf/plugins/math': comarkPdfMath,
    'comark-pdf/plugins/mermaid': comarkPdfMermaid,
    'comark-pdf/preview': comarkPdfPreview,
    'comark-pdf': comarkPdf,
  },
  runtimeConfig: {
    public: {
      siteUrl: 'https://miguelrk.github.io/comark-packages/comark-pdf',
    },
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-pdf/',
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'color-scheme', content: 'light dark' }],
      link: [{ rel: 'icon', href: 'data:,' }],
    },
  },
  nitro: {
    alias: {
      'comark-pdf/plugins/math': comarkPdfMath,
      'comark-pdf/plugins/mermaid': comarkPdfMermaid,
      'comark-pdf/preview': comarkPdfPreview,
      'comark-pdf': comarkPdf,
    },
    prerender: {
      routes: ['/'],
      crawlLinks: true,
      ignore: ['/LICENSE', '/comark-packages/comark-pdf/LICENSE'],
    },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^comark-pdf\/plugins\/math$/, replacement: comarkPdfMath },
        { find: /^comark-pdf\/plugins\/mermaid$/, replacement: comarkPdfMermaid },
        { find: /^comark-pdf\/preview$/, replacement: comarkPdfPreview },
        { find: /^comark-pdf$/, replacement: comarkPdf },
      ],
    },
    server: {
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    },
  },
})
