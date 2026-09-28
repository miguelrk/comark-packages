/**
 * Generate the plugin pages and the commands reference from the plugin
 * objects, so the docs never drift from the code.
 *
 *   pnpm gen:docs
 */
import type { EditorPlugin } from '../src/types.ts'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { coreCommands } from '../src/commands/catalog.ts'
import { defaultPlugins } from '../src/presets/defaults.ts'
import { presetBuiltins } from '../src/presets/builtins.ts'
import { presetEcosystem } from '../src/presets/ecosystem.ts'
import rangi from '../src/plugins/rangi.ts'
import shiki from '../src/plugins/shiki.ts'

const CONTENT = join(import.meta.dirname, '../docs/content')

const GROUPS: [string, string, string, EditorPlugin[]][] = [
  ['2.defaults', 'Defaults', 'i-lucide-package-check', defaultPlugins()],
  ['3.built-in', 'Built-in', 'i-lucide-package', [...presetBuiltins(), rangi(), shiki()].sort((a, b) => a.name.localeCompare(b.name))],
  ['4.ecosystem', 'Ecosystem', 'i-lucide-boxes', presetEcosystem()],
]

const INTRO: Record<string, string> = {
  'alert': 'GitHub-style `> [!TYPE]` callouts.',
  'attributes': 'Attribute blocks after inline elements and headings: `**bold**{.x}`, `[span]{.x}`, `## Title {#id}`.',
  'components': 'Block and inline components from the manifest: names, props, values, slots, YAML props and bound props, as one chain.',
  'frontmatter': 'YAML frontmatter: keys and values from `frontmatterSchema`, required keys and enum values checked.',
  'html': 'HTML tags and attributes, and the closing tag of the open element.',
  'task-list': 'Task lists: `- [ ]` and `- [x]`.',
  'binding': '`{{ path || fallback }}` interpolation and the `::if` / `::for` components.',
  'breaks': 'Soft line breaks render as `<br>`.',
  'code-blocks': 'Fence languages and meta: `[filename]`, `{1,3-5}`, `diff`.',
  'emoji': 'Emoji shortcodes with their glyph.',
  'footnotes': 'Footnote references and definitions.',
  'headings': 'Heading anchors, duplicate and broken anchor checks, `meta.title` and `meta.description`.',
  'json-render': 'UI specs in ```` ```json-render ```` fences.',
  'math': 'Inline and display LaTeX, with KaTeX commands.',
  'mermaid': 'Mermaid diagrams: diagram types and keywords.',
  'model': 'Two-way `::prop="data.x"` bindings.',
  'punctuation': 'Typographic quotes, dashes and ellipses.',
  'rangi': 'Fence languages rangi highlights (optional peer `rangi`).',
  'security': 'What comark\'s security plugin removes, reported while you write.',
  'shiki': 'Fence languages Shiki bundles (optional peer `shiki`).',
  'summary': 'The `<!-- more -->` summary break and `meta.summary`.',
  'toc': 'The table of contents as `meta.toc`.',
  'twoslash': '```` ```ts twoslash ```` fences and their annotations.',
  'email': 'comark-email layout components.',
  'etiket': 'comark-etiket barcodes and QR codes.',
  'flint': 'comark-flint-chart charts.',
  'page-break': 'comark-pdf page breaks.',
  'vega': 'comark-vega charts.',
}

const esc = (s: string) => s.replace(/\|/g, '\\|')

function page(plugin: EditorPlugin, group: string): string {
  const adds: string[] = []
  const kinds = [...new Set((plugin.completions ?? []).flatMap(c => c.kinds))]
  if (kinds.length) adds.push(`- **Completion** in ${kinds.map(k => `\`${k}\``).join(', ')}`)
  if (plugin.snippets?.length) adds.push(`- **Snippets**: ${plugin.snippets.map(s => `*${s.label}*`).join(', ')}`)
  if (plugin.components?.length) adds.push(`- **Components**: ${plugin.components.slice(0, 12).map(c => `\`${c.kind === 'inline' ? ':' : '::'}${c.name}\``).join(', ')}${plugin.components.length > 12 ? `, … (${plugin.components.length})` : ''}`)
  if (plugin.scopes?.length) adds.push('- **Binding roots** (`scopes`)')
  if (plugin.fences?.length) adds.push(`- **Fence languages**: ${plugin.fences.map(f => `\`${f}\``).join(', ')}`)
  if (plugin.lint?.length) adds.push('- **Lint**')
  if (plugin.hover?.length) adds.push('- **Hover**')
  if (plugin.commands?.length) adds.push(`- **Commands**: ${plugin.commands.map(c => `\`${c.name}\``).join(', ')}`)
  const lines = [
    '---',
    `title: ${plugin.name}`,
    `description: ${JSON.stringify(INTRO[plugin.name] ?? plugin.name)}`,
    '---',
    '',
    INTRO[plugin.name] ?? '',
    '',
    '```ts',
    group === '2.defaults'
      ? `// registered by default; to configure it:\nimport ${camel(plugin.name)} from 'comark-codemirror/plugins/${plugin.name}'\n\ncomark({ plugins: [${camel(plugin.name)}()] })`
      : `import ${camel(plugin.name)} from 'comark-codemirror/plugins/${plugin.name}'\n\ncomark({ plugins: [${camel(plugin.name)}()] })`,
    '```',
    '',
  ]
  if (adds.length) lines.push('## What it adds', '', ...adds, '')
  const components = plugin.components ?? []
  if (components.length) {
    lines.push('## Components', '', '| Component | Props | Slots |', '|---|---|---|')
    for (const c of components.slice(0, 40)) {
      const props = Object.entries(c.props ?? {}).map(([n, p]) => `\`${n}\`${p.enum ? ` (${esc(p.enum.join(' | '))})` : ''}`).join(', ')
      lines.push(`| \`${c.kind === 'inline' ? ':' : '::'}${c.name}\` | ${props || '–'} | ${(c.slots ?? []).filter(s => s.name !== 'default').map(s => `\`#${s.name}\``).join(', ') || '–'} |`)
    }
    lines.push('')
  }
  if (plugin.llms) lines.push('## For agents', '', 'Included in `llms()`:', '', ...plugin.llms.split('\n').map(l => `> ${l}`), '')
  return lines.join('\n')
}

const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())

for (const [dir, title, icon, plugins] of GROUPS) {
  const path = join(CONTENT, '5.plugins', dir)
  rmSync(path, { recursive: true, force: true })
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, '.navigation.yml'), `title: ${title}\nicon: ${icon}\n`)
  plugins.forEach((plugin, i) => writeFileSync(join(path, `${i}.${plugin.name}.md`), page(plugin, dir)))
}

const commands = [...coreCommands, ...[...defaultPlugins(), ...presetBuiltins()].flatMap(p => p.commands ?? [])]
const ref = [
  '---',
  'title: Commands',
  'description: Every command, for keymaps and agents.',
  'navigation:',
  '  icon: i-lucide-terminal',
  '---',
  '',
  'Commands are pure functions `(state, params) → Edit`. Run them with `runCommand(state, name, params)` or as agent [tools](/agents/tools); every command also accepts `target`.',
  '',
  '| Command | Params | Description |',
  '|---|---|---|',
  ...commands.map(c => `| \`${c.name}\` | ${Object.entries(c.params?.properties ?? {}).map(([n, s]) => `\`${n}\`${(s as { enum?: unknown[] }).enum ? ` (${esc((s as { enum: unknown[] }).enum.join(' | '))})` : ''}`).join(', ') || '–'} | ${esc(c.description)} |`),
  '',
].join('\n')
writeFileSync(join(CONTENT, '7.reference', '3.commands.md'), ref)
console.log(`Generated ${GROUPS.reduce((n, g) => n + g[3].length, 0)} plugin pages and ${commands.length} commands.`)
