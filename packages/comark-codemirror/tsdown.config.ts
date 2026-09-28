import { defineConfig } from 'tsdown'

const plugins = [
  // defaults
  'alert', 'attributes', 'components', 'frontmatter', 'html', 'task-list',
  // built-ins
  'binding', 'breaks', 'code-blocks', 'emoji', 'footnotes', 'headings', 'json-render', 'math', 'mermaid',
  'model', 'punctuation', 'rangi', 'security', 'shiki', 'summary', 'toc', 'twoslash',
  // ecosystem (comark-packages)
  'email', 'etiket', 'flint', 'page-break', 'vega',
]

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'agent': 'src/agent/index.ts',
    'vite': 'src/vite.ts',
    'presets/builtins': 'src/presets/builtins.ts',
    'presets/ecosystem': 'src/presets/ecosystem.ts',
    ...Object.fromEntries(plugins.map(name => [`plugins/${name}`, `src/plugins/${name}.ts`])),
  },
  // ESM only — Comark is a pure-ESM package.
  format: ['esm'],
  dts: true,
  // CodeMirror and Lezer are peers and stay external.
})
