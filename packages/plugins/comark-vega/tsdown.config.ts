import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/vue/index.ts'],
  // ESM only — Comark is a pure-ESM package, so a CJS build would fail at
  // runtime. Add 'cjs' here only if you really need it.
  format: ['esm'],
  // Emit type declarations alongside the JS.
  dts: true,
  // Peers / framework deps stay external; only package code is bundled.
  deps: {
    neverBundle: ['vue', 'vega', 'vega-lite', 'comark', 'comark/utils'],
  },
})
