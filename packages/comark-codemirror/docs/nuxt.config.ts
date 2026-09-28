import { fileURLToPath } from 'node:url'

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url))

export default defineNuxtConfig({
  extends: ['docus'],
  compatibilityDate: '2025-07-15',
  site: {
    name: 'comark-codemirror',
    url: 'https://miguelrk.github.io',
  },
  // robots.txt must live at the domain root, not under the GitHub Pages base path
  robots: { robotsTxt: false },
  // develop the docs against the library sources (no build step)
  alias: {
    'comark-codemirror/agent': src('agent/index.ts'),
    'comark-codemirror/presets/builtins': src('presets/builtins.ts'),
    'comark-codemirror/presets/ecosystem': src('presets/ecosystem.ts'),
    'comark-codemirror/plugins/rangi': src('plugins/rangi.ts'),
    'comark-codemirror': src('index.ts'),
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-codemirror/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/comark-codemirror',
    title: 'comark-codemirror',
    description: 'A Comark code editor for CodeMirror 6 where you can autocomplete everything: components, props, values, slots, bindings and all plugin syntax, in chained menus.',
    // llms-full.txt is served from the authored Markdown by server/routes/llms-full.txt.get.ts
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/comark-codemirror/llms-full.txt', 'Agent skill: npx skills add https://miguelrk.github.io/comark-packages/comark-codemirror'],
  },
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
    // one CodeMirror instance for the docs and the library sources
    resolve: { dedupe: ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/autocomplete', '@codemirror/lint', '@lezer/common', '@lezer/highlight', '@lezer/markdown'] },
    optimizeDeps: { include: ['comark', '@comark/html', 'codemirror', '@codemirror/language-data'] },
  },
  nitro: {
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
