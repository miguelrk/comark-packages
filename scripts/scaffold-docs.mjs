import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const packagesDir = join(root, 'packages')

const packages = [
  {
    name: 'comark-arrow',
    title: 'comark-arrow',
    description: 'Comark plugin for ArrowJS sandboxed widgets — agent-authored UI with no upfront component registration.',
    tagline: 'Sandboxed ArrowJS widgets for Comark.',
    headline: 'Arrow',
    aliases: [
      `'comark-arrow/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url))`,
      `'comark-arrow/html': fileURLToPath(new URL('../src/html.ts', import.meta.url))`,
      `'comark-arrow': fileURLToPath(new URL('../src/index.ts', import.meta.url))`,
    ],
    deps: {
      '@arrow-js/sandbox': '1.0.6',
      '@comark/nuxt': 'catalog:',
      comark: 'catalog:',
      rangi: 'catalog:',
      vue: 'catalog:',
    },
    hasPlay: true,
  },
  {
    name: 'comark-email',
    title: 'comark-email',
    description: 'Email renderer for Comark. Convert Markdown to responsive, MJML-compiled HTML for email clients.',
    tagline: 'Convert Markdown to responsive, MJML-compiled email HTML — parse-time, Node-only.',
    headline: 'Email',
    aliases: [`'comark-email': fileURLToPath(new URL('../src/index.ts', import.meta.url))`],
    deps: { '@comark/html': 'catalog:', '@comark/nuxt': 'catalog:', comark: 'catalog:', rangi: 'catalog:' },
    hasPlay: true,
  },
  {
    name: 'comark-etiket',
    title: 'comark-etiket',
    description: 'Comark plugin to render barcode and QR codes to inline SVG (or PNG) at parse time with etiket.',
    tagline: 'Directives become inline SVG (or PNG) at parse time — no runtime component needed.',
    headline: 'Barcode & QR',
    aliases: [`'comark-etiket': fileURLToPath(new URL('../src/index.ts', import.meta.url))`],
    deps: {
      '@comark/nuxt': 'catalog:',
      '@comark/vue': 'catalog:',
      comark: 'catalog:',
      etiket: '^0.12.0',
      rangi: 'catalog:',
      vue: 'catalog:',
    },
    hasPlay: true,
  },
  {
    name: 'comark-flint-chart',
    title: 'comark-flint-chart',
    description: 'Comark plugin for Flint charts — AST component nodes with a shipped Vue renderer, plus optional parse-time SVG/img for static docs.',
    tagline: 'Fenced Flint specs become Vega-Lite or ECharts charts with a shipped Vue renderer.',
    headline: 'Flint charts',
    aliases: [
      `'comark-flint-chart/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url))`,
      `'comark-flint-chart': fileURLToPath(new URL('../src/index.ts', import.meta.url))`,
    ],
    deps: {
      '@comark/nuxt': 'catalog:',
      '@comark/vue': 'catalog:',
      comark: 'catalog:',
      'flint-chart': '^0.5.1',
      rangi: 'catalog:',
      vue: 'catalog:',
      'vega-embed': '^6.29.0',
      vega: '^6.0.0',
      'vega-lite': '^6.4.3',
    },
    hasPlay: true,
  },
  {
    name: 'comark-kv',
    title: 'comark-kv',
    description: 'Comark plugin for unstorage-backed key-value state with two-way kv.* model binding.',
    tagline: 'Frontmatter kv entries resolve into a live, persisted model at parse + render time.',
    headline: 'KV',
    aliases: [
      `'comark-kv/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url))`,
      `'comark-kv/model': fileURLToPath(new URL('../src/model/index.ts', import.meta.url))`,
      `'comark-kv': fileURLToPath(new URL('../src/index.ts', import.meta.url))`,
    ],
    deps: {
      '@comark/nuxt': 'catalog:',
      '@comark/vue': 'catalog:',
      comark: 'catalog:',
      rangi: 'catalog:',
      unstorage: '^1.15.0',
      vue: 'catalog:',
    },
    hasPlay: true,
  },
  {
    name: 'comark-pdf',
    title: 'comark-pdf',
    description: 'PDF renderer for Comark. Convert Markdown to print-ready PDF bytes via jasy — no headless browser required.',
    tagline: 'Render Comark documents to PDF bytes via jasy.',
    headline: 'PDF',
    aliases: [`'comark-pdf': fileURLToPath(new URL('../src/index.ts', import.meta.url))`],
    deps: { '@comark/nuxt': 'catalog:', comark: 'catalog:', rangi: 'catalog:' },
    hasPlay: true,
  },
  {
    name: 'comark-vega',
    title: 'comark-vega',
    description: 'Comark plugin for Vega and Vega-Lite charts — AST component nodes with a shipped Vue renderer, plus optional parse-time SVG/img for static docs.',
    tagline: 'Fenced specs and directives become interactive charts with a shipped Vue renderer.',
    headline: 'Vega charts',
    aliases: [
      `'comark-vega/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url))`,
      `'comark-vega': fileURLToPath(new URL('../src/index.ts', import.meta.url))`,
    ],
    deps: {
      '@comark/nuxt': 'catalog:',
      '@comark/vue': 'catalog:',
      comark: 'catalog:',
      rangi: 'catalog:',
      vega: '^6.0.0',
      'vega-lite': '^6.4.3',
      vue: 'catalog:',
    },
    hasPlay: true,
  },
]

const gitignore = `node_modules
.nuxt
.output
.data
dist
`

const llmsRoute = (title, blurb) => `/**
 * \`llms-full.txt\` built from the authored Markdown (frontmatter stripped),
 * in navigation order.
 */
export default defineEventHandler(async (event) => {
  const storage = useStorage('assets:docs')
  const keys = (await storage.getKeys()).filter(k => k.endsWith('.md') && !k.endsWith('index.md')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const parts = ['# ${title}', '', '> ${blurb}', '']
  for (const key of keys) {
    const raw = String(await storage.getItem(key) ?? '')
    const fm = /^---\\n([\\s\\S]*?)\\n---\\n?/.exec(raw)
    const titleMatch = fm && /^title:\\s*(.+)$/m.exec(fm[1]!)?.[1]?.replace(/^["']|["']$/g, '')
    const body = raw.slice(fm ? fm[0].length : 0).trim()
    parts.push(\`# \${titleMatch ?? key}\`, '', body, '')
  }
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return parts.join('\\n')
})
`

for (const pkg of packages) {
  const docsDir = join(packagesDir, pkg.name, 'docs')
  mkdirSync(join(docsDir, 'app'), { recursive: true })
  mkdirSync(join(docsDir, 'content'), { recursive: true })
  mkdirSync(join(docsDir, 'public'), { recursive: true })
  mkdirSync(join(docsDir, 'server/routes'), { recursive: true })

  writeFileSync(join(docsDir, '.gitignore'), gitignore)

  const deps = {
    'better-sqlite3': '^12.2.0',
    docus: '^5.13.0',
    nuxt: 'catalog:',
    [pkg.name]: 'workspace:*',
    ...pkg.deps,
  }

  writeFileSync(join(docsDir, 'package.json'), `${JSON.stringify({
    name: `${pkg.name}-docs`,
    private: true,
    type: 'module',
    scripts: {
      dev: 'nuxt dev',
      build: 'nuxt build',
      generate: 'nuxt generate',
      preview: 'nuxt preview',
    },
    dependencies: deps,
  }, null, 2)}\n`)

  const aliasBlock = pkg.aliases.map(a => `    ${a},`).join('\n')
  const viteExtra = pkg.name === 'comark-arrow'
    ? `
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
    optimizeDeps: {
      include: ['typescript', '@arrow-js/sandbox', '@arrow-js/sandbox > typescript', 'quickjs-emscripten'],
    },
  },`
    : pkg.name === 'comark-codemirror'
      ? ''
      : `
  vite: {
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  },`

  const styleSrc = join(packagesDir, pkg.name, 'playground/app/assets/style.css')
  const hasStyle = existsSync(styleSrc)
  if (hasStyle) {
    mkdirSync(join(docsDir, 'app/assets'), { recursive: true })
    cpSync(styleSrc, join(docsDir, 'app/assets/style.css'))
  }

  writeFileSync(join(docsDir, 'nuxt.config.ts'), `import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@comark/nuxt'],${hasStyle ? "\n  css: ['~/assets/style.css']," : ''}
  compatibilityDate: '2025-07-15',
  site: {
    name: '${pkg.name}',
    url: 'https://miguelrk.github.io',
  },
  robots: { robotsTxt: false },
  alias: {
${aliasBlock}
  },
  app: {
    baseURL: process.env.NODE_ENV === 'development' ? '/' : '/comark-packages/${pkg.name}/',
  },
  llms: {
    domain: 'https://miguelrk.github.io/comark-packages/${pkg.name}',
    title: '${pkg.name}',
    description: '${pkg.description.replace(/'/g, "\\'")}',
    full: false,
    notes: ['Full documentation in one file: https://miguelrk.github.io/comark-packages/${pkg.name}/llms-full.txt'],
  },${viteExtra}
  nitro: {
    prerender: { crawlLinks: true, failOnError: false, routes: ['/llms-full.txt'] },
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
  },
})
`)

  writeFileSync(join(docsDir, 'app/app.config.ts'), `export default defineAppConfig({
  docus: {
    locale: 'en',
  },
  seo: {
    title: '${pkg.name}',
    description: '${pkg.tagline.replace(/'/g, "\\'")}',
  },
  header: {
    title: '${pkg.name}',
  },
  github: {
    url: 'https://github.com/miguelrk/comark-packages/tree/main/packages/${pkg.name}',
    branch: 'main',
    rootDir: 'docs',
  },
  toc: {
    title: 'On this page',
  },
})
`)

  writeFileSync(join(docsDir, 'server/routes/llms-full.txt.get.ts'), llmsRoute(pkg.name, pkg.tagline))

  const ogSrc = join(packagesDir, pkg.name, 'playground/public/og.png')
  const ogDst = join(docsDir, 'public/og.png')
  if (existsSync(ogSrc)) cpSync(ogSrc, ogDst)

  if (pkg.hasPlay) {
    mkdirSync(join(docsDir, 'app/pages'), { recursive: true })
    const playSrc = join(packagesDir, pkg.name, 'playground/app/pages/play.vue')
    if (existsSync(playSrc))
      cpSync(playSrc, join(docsDir, 'app/pages/play.vue'))
    const examplesSrc = join(packagesDir, pkg.name, 'playground/app/examples')
    if (existsSync(examplesSrc))
      cpSync(examplesSrc, join(docsDir, 'app/examples'), { recursive: true })
  }

  console.log(`scaffolded ${pkg.name}/docs`)
}
