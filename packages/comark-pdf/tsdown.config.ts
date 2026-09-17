import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/node.ts',
    'src/preview.ts',
    'src/render.ts',
    'src/plugins/page-break.ts',
    'src/plugins/math.ts',
    'src/plugins/mermaid.ts',
  ],
  format: ['esm'],
  dts: true,
})
