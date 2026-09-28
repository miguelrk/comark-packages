/**
 * Bundle size of what a host ships on top of CodeMirror (which stays
 * external): `comark()` with the default plugins, and with all plugins.
 * Fails when a budget is exceeded.
 *
 *   pnpm build && pnpm size
 */
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const BUDGETS = [
  { name: 'comark() + default plugins', code: `export { comark } from './dist/index.mjs'`, kb: 27 },
  { name: 'comark() + all plugins', code: `export { comark } from './dist/index.mjs'\nexport * from './dist/presets/builtins.mjs'\nexport * from './dist/presets/ecosystem.mjs'`, kb: 35 },
  { name: 'agent API', code: `export * from './dist/agent.mjs'`, kb: 30 },
]

let failed = false
for (const budget of BUDGETS) {
  const out = await build({
    stdin: { contents: budget.code, resolveDir: `${import.meta.dirname}/..`, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    splitting: true,
    outdir: 'out',
    metafile: true,
    external: ['@codemirror/*', '@lezer/*', 'rangi', 'rangi/*', 'shiki'],
    logLevel: 'silent',
  })
  // the eager entry chunk; lazy chunks (emoji data) load on first use
  const [entry, ...lazy] = out.outputFiles.sort((a, b) => Number(b.path.endsWith('stdin.js')) - Number(a.path.endsWith('stdin.js')))
  const kb = gzipSync(entry!.text).length / 1024
  const lazyKb = lazy.reduce((n, f) => n + gzipSync(f.text).length, 0) / 1024
  const ok = kb <= budget.kb
  failed ||= !ok
  console.log(`${ok ? '✓' : '✗'} ${budget.name.padEnd(30)} ${kb.toFixed(1).padStart(5)} KB gz (budget ${budget.kb} KB)${lazyKb ? `, +${lazyKb.toFixed(1)} KB lazy` : ''}`)
}
process.exit(failed ? 1 : 0)
