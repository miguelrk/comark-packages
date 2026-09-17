import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/model/index.ts', 'src/vue/index.ts'],
  format: ['esm'],
  dts: true,
  deps: {
    neverBundle: ['comark', 'vue', 'unstorage'],
  },
})
