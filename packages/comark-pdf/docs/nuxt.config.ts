import { fileURLToPath } from 'node:url'

const comarkPdf = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const comarkPdfPreview = fileURLToPath(new URL('../src/preview.ts', import.meta.url))
const comarkPdfMath = fileURLToPath(new URL('../src/plugins/math.ts', import.meta.url))
const comarkPdfMermaid = fileURLToPath(new URL('../src/plugins/mermaid.ts', import.meta.url))

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  compatibilityDate: '2025-07-15',
  site: {
    name: 'comark-pdf',
    url: 'https://miguelrk.github.io',
  },
  robots: { robotsTxt: false },
  alias: {
    'comark-pdf/plugins/math': comarkPdfMath,
    'comark-pdf/plugins/mermaid': comarkPdfMermaid,
    'comark-pdf/preview': comarkPdfPreview,
    'comark-pdf': comarkPdf,
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-pdf/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/comark-pdf',
    title: 'comark-pdf',
    description: 'PDF renderer for Comark. Convert Markdown to print-ready PDF bytes via jasy — no headless browser required.',
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/comark-pdf/llms-full.txt'],
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
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  },
  nitro: {
    alias: {
      'comark-pdf/plugins/math': comarkPdfMath,
      'comark-pdf/plugins/mermaid': comarkPdfMermaid,
      'comark-pdf/preview': comarkPdfPreview,
      'comark-pdf': comarkPdf,
    },
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
