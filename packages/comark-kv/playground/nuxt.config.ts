import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const kvAliases = {
  'comark-kv/model': `${root}/src/model/index.ts`,
  'comark-kv/vue': `${root}/src/vue/index.ts`,
  'comark-kv': `${root}/src/index.ts`,
}

export default defineNuxtConfig({
  compatibilityDate: '2026-09-16',
  modules: ['@comark/nuxt'],
  css: ['~/assets/style.css'],
  // Only alias comark-kv to live source. Do NOT alias `comark` / `@comark/vue`
  // to package directories — that bypasses package.json "exports" and breaks
  // subpaths like `comark/utils` and `comark/plugins/rangi`. Those resolve via
  // the workspace catalog.
  alias: kvAliases,
  runtimeConfig: {
    public: {
      siteUrl: 'https://miguelrk.github.io/comark-kv',
    },
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/comark-kv/',
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ charset: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  nitro: {
    alias: kvAliases,
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      ignore: ['/LICENSE', '/comark-packages/comark-kv/LICENSE'],
    },
  },
  vite: {
    resolve: {
      alias: kvAliases,
      dedupe: ['comark', '@comark/vue', 'vue'],
    },
    server: {
      fs: {
        allow: [root],
      },
    },
    optimizeDeps: {
      include: ['comark', 'comark/utils', 'comark/model', 'unstorage'],
      exclude: ['comark-kv', 'comark-kv/model', 'comark-kv/vue'],
    },
  },
})
