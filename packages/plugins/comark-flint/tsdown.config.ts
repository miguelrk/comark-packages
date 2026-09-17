import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/vue/index.ts'],
  // ESM only — Comark is a pure-ESM package, so a CJS build would fail at
  // runtime. Add 'cjs' here only if you really need it.
  format: ['esm'],
  // Emit type declarations alongside the JS.
  dts: true,
  // Keep peers out of the bundle (Vue renderer loads them at runtime).
  deps: {
    neverBundle: ['vue', 'vega-embed', 'echarts', 'vega', 'vega-lite', 'flint-chart'],
  },
})
