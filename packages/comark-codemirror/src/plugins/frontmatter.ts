/**
 * Frontmatter (default): YAML at the top of the document. With a
 * `frontmatterSchema` (JSON Schema), completes keys (nested objects drill in)
 * and enum/boolean values, and checks required keys and enum values.
 */
import type { Diagnostic } from '@codemirror/lint'
import type { CompletionProvider, Item, JSONSchema, ProviderContext } from '../types.ts'
import { setFrontmatter } from '../commands/index.ts'
import { definePlugin } from '../plugins.ts'

function schemaAt(schema: JSONSchema | undefined, path: readonly string[]): JSONSchema | undefined {
  let cur = schema
  for (const seg of path) cur = cur?.properties?.[seg] ?? (cur?.items?.properties?.[seg])
  return cur
}

const typeOf = (s: JSONSchema) => (Array.isArray(s.type) ? s.type[0] : s.type) ?? (s.properties ? 'object' : 'any')

function valueItems(schema: JSONSchema | undefined): Item[] {
  if (!schema) return []
  if (schema.enum) return schema.enum.map(v => ({ label: String(v), type: 'value', detail: v === schema.default ? 'default' : undefined }))
  if (typeOf(schema) === 'boolean') return [{ label: 'true', type: 'value' }, { label: 'false', type: 'value' }]
  if (schema.default !== undefined) return [{ label: String(schema.default), type: 'value', detail: 'default' }]
  return []
}

const providers: CompletionProvider<any>[] = [
  {
    kinds: ['block'],
    provide(ctx: ProviderContext<'block'>) {
      const { context } = ctx
      if (context.line !== 1 || ctx.index.frontmatter.node) return null
      const item: Item = { label: context.typed.startsWith('-') ? '---' : 'Frontmatter', insert: '---\n$0\n---\n', detail: 'YAML metadata', type: 'frontmatter', section: 'Document', chain: !!ctx.config.options.frontmatterSchema }
      return [item]
    },
  },
  {
    kinds: ['frontmatter-key'],
    provide(ctx: ProviderContext<'frontmatter-key'>) {
      const schema = schemaAt(ctx.config.options.frontmatterSchema, ctx.context.path)
      const present = new Set(ctx.context.present)
      const required = new Set(schema?.required ?? [])
      return Object.entries(schema?.properties ?? {}).filter(([k]) => !present.has(k)).map(([key, s]) => {
        const type = typeOf(s)
        const nested = type === 'object'
        return {
          label: key,
          insert: nested ? `${key}:\n${' '.repeat(ctx.context.path.length * 2 + 2)}$0` : type === 'array' ? `${key}:\n${' '.repeat(ctx.context.path.length * 2 + 2)}- $0` : `${key}: $0`,
          detail: `${s.enum ? s.enum.join(' | ') : type}${required.has(key) ? ' · required' : ''}`,
          info: { title: key, description: s.description, rows: [['type', String(type)]] },
          type: 'prop',
          boost: required.has(key) ? 10 : 0,
          chain: nested || !!s.enum || type === 'boolean',
          drill: nested,
        }
      })
    },
  },
  {
    kinds: ['frontmatter-value'],
    provide: (ctx: ProviderContext<'frontmatter-value'>) => valueItems(schemaAt(ctx.config.options.frontmatterSchema, [...ctx.context.path, ctx.context.key])),
  },
]

export default definePlugin(() => ({
  name: 'frontmatter',
  completions: providers,
  lint: [({ state, index, config }) => {
    const schema = config.options.frontmatterSchema
    const fm = index.frontmatter.node
    if (!schema || !fm) return []
    const out: Diagnostic[] = []
    const first = state.doc.line(fm.line)
    for (const key of schema.required ?? []) {
      if (key in index.frontmatter.value) continue
      const prop = schema.properties?.[key]
      out.push({
        from: first.from,
        to: first.to,
        severity: 'error',
        source: 'frontmatter',
        message: `Frontmatter needs \`${key}\`.`,
        actions: [{ name: `Add ${key}`, apply: (view) => {
          const edit = setFrontmatter(view.state, key, prop?.default ?? '')
          if (edit.ok) view.dispatch({ changes: edit.changes })
        } }],
      })
    }
    for (const [key, value] of Object.entries(index.frontmatter.value)) {
      const prop = schema.properties?.[key]
      if (!prop?.enum || prop.enum.map(String).includes(String(value))) continue
      for (let l = fm.line + 1; l < fm.endLine; l++) {
        const line = state.doc.line(l)
        if (line.text.startsWith(`${key}:`)) out.push({ from: line.from, to: line.to, severity: 'error', source: 'frontmatter', message: `\`${key}\` must be one of ${prop.enum.map(v => `\`${v}\``).join(', ')}.` })
      }
    }
    return out
  }],
  llms: 'Frontmatter: YAML between `---` lines at the very top of the document. Its values are available to bindings as `frontmatter.*`.',
}))
