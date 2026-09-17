import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/render.ts', 'src/config.ts'],
  format: ['esm'],
  dts: true,
  deps: {
    neverBundle: ['comark', '@comark/html', 'mjml'],
  },
})
