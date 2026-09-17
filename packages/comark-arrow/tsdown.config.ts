import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/vue/index.ts', 'src/html.ts', 'src/ansi.ts'],
  format: ['esm'],
  dts: true,
  deps: {
    neverBundle: ['vue', '@arrow-js/sandbox'],
  },
})
