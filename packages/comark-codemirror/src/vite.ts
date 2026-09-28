/**
 * comark-codemirror/vite — optional. Generates the component manifest from your
 * project's components so completions, hover docs and lint match the
 * components your app actually renders.
 *
 * ```ts
 * // vite.config.ts
 * import { comarkCodemirrorComponents } from 'comark-codemirror/vite'
 * export default { plugins: [comarkCodemirrorComponents({ dirs: ['components/content'] })] }
 *
 * // editor.ts
 * import components from 'virtual:comark-codemirror/components'
 * new EditorView({ extensions: [basicSetup, comark({ components })] })
 * ```
 *
 * Extraction is static and dependency-free (Vue `defineProps` type/runtime
 * forms, `withDefaults`, `<slot name>`; React props interfaces/type literals).
 * It is intentionally conservative — pass `manifest` entries to refine.
 */
import type { ComponentDef, PropDef, PropType, SlotDef } from './types.ts'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'

export const VIRTUAL_ID = 'virtual:comark-codemirror/components'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export interface ComponentsPluginOptions {
  /** Directories to scan (relative to the Vite root). @default ['components/content', 'app/components/content'] */
  dirs?: string[]
  /** Files to include. @default /\.(vue|tsx|jsx)$/ */
  include?: RegExp
  /** Extra or overriding manifest entries (merged by name). */
  manifest?: ComponentDef[]
  /** Map a file path to a component name. @default kebab-case of the file name */
  name?: (file: string) => string
}

/** Minimal structural Vite plugin type (no dependency on vite). */
export interface VitePluginLike {
  name: string
  enforce?: 'pre' | 'post'
  configResolved?: (config: { root: string }) => void
  resolveId?: (id: string) => string | undefined
  load?: (id: string) => string | undefined
  configureServer?: (server: { watcher: { add: (paths: string[]) => void, on: (event: string, fn: (file: string) => void) => void }, moduleGraph: { getModuleById: (id: string) => unknown, invalidateModule: (mod: never) => void }, ws: { send: (payload: { type: string }) => void } }) => void
}

export function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase()
}

function typeOf(raw: string): Pick<PropDef, 'type' | 'enum'> {
  const t = raw.trim().replace(/\s+/g, ' ')
  const literals = t.split('|').map(s => s.trim())
  if (literals.length && literals.every(l => /^(['"]).*\1$/.test(l))) return { type: 'string', enum: literals.map(l => l.slice(1, -1)) }
  if (literals.length > 1 && literals.every(l => /^-?\d+(\.\d+)?$/.test(l))) return { type: 'number', enum: literals.map(Number) }
  if (/^(String|string)$/.test(t)) return { type: 'string' }
  if (/^(Number|number)$/.test(t)) return { type: 'number' }
  if (/^(Boolean|boolean)$/.test(t)) return { type: 'boolean' }
  if (/\[\]$|^Array\b|^(readonly )?\w+\[\]/.test(t)) return { type: 'array' }
  if (/^(Object|Record\b|\{)/.test(t)) return { type: 'object' }
  return { type: 'any' }
}

/** Members of a TS type literal / interface body: `a: string; b?: 'x' | 'y'`. */
function typeMembers(body: string): Record<string, PropDef> {
  const out: Record<string, PropDef> = {}
  let depth = 0
  let current = ''
  const parts: string[] = []
  for (const ch of body) {
    if (ch === '{' || ch === '(' || ch === '<' || ch === '[') depth++
    if (ch === '}' || ch === ')' || ch === '>' || ch === ']') depth--
    if ((ch === ';' || ch === '\n' || ch === ',') && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current)
  let doc = ''
  for (const part of parts) {
    const text = part.trim()
    const comment = /\/\*\*?([\s\S]*?)\*\//.exec(text)
    if (comment) doc = comment[1]!.replace(/^\s*\*\s?/gm, '').trim()
    const m = /(?:^|\*\/\s*)(?:readonly\s+)?['"]?([\w$-]+)['"]?(\?)?\s*:\s*([\s\S]+)$/.exec(text.replace(/\/\/.*$/gm, ''))
    if (!m) continue
    out[m[1]!] = { ...typeOf(m[3]!), required: !m[2], ...(doc ? { description: doc } : {}) }
    doc = ''
  }
  return out
}

function matchBalanced(source: string, start: number, open = '{', close = '}'): string | null {
  let depth = 0
  for (let i = start; i < source.length; i++) {
    if (source[i] === open) depth++
    else if (source[i] === close && --depth === 0) return source.slice(start + 1, i)
  }
  return null
}

/** Extract a component definition from a Vue SFC or a React component file. */
export function extractComponent(file: string, source: string, name = kebabCase(basename(file, extname(file)))): ComponentDef {
  let props: Record<string, PropDef> = {}
  const slots: SlotDef[] = []
  if (file.endsWith('.vue')) {
    const typed = /defineProps\s*<\s*/.exec(source)
    if (typed) {
      const after = source.slice(typed.index + typed[0].length)
      if (after.startsWith('{')) props = typeMembers(matchBalanced(after, 0) ?? '')
      else {
        const iface = /^(\w+)/.exec(after)?.[1]
        const decl = iface ? new RegExp(`(?:interface|type)\\s+${iface}\\s*=?\\s*(?:extends[^{]*)?\\{`).exec(source) : null
        if (decl) props = typeMembers(matchBalanced(source, decl.index + decl[0].length - 1) ?? '')
      }
    }
    else {
      const runtime = /defineProps\s*\(\s*\{/.exec(source)
      if (runtime) {
        const body = matchBalanced(source, runtime.index + runtime[0].length - 1) ?? ''
        const re = /([\w$]+)\s*:\s*(\{[^{}]*\}|[\w$[\]]+)/g
        let m: RegExpExecArray | null
        while ((m = re.exec(body))) {
          const value = m[2]!
          if (value.startsWith('{')) {
            const type = /type\s*:\s*([\w$[\]]+)/.exec(value)?.[1] ?? 'any'
            props[m[1]!] = { ...typeOf(type), required: /required\s*:\s*true/.test(value) }
            const def = /default\s*:\s*(['"`])(.*?)\1/.exec(value)
            if (def) props[m[1]!]!.default = def[2]
          }
          else props[m[1]!] = { ...typeOf(value), required: false }
        }
      }
    }
    const defaults = /withDefaults\s*\([\s\S]*?\)\s*,\s*\{/.exec(source)
    if (defaults) {
      const body = matchBalanced(source, defaults.index + defaults[0].length - 1) ?? ''
      for (const m of body.matchAll(/([\w$]+)\s*:\s*(['"`])(.*?)\2/g)) {
        if (props[m[1]!]) {
          props[m[1]!]!.default = m[3]
          props[m[1]!]!.required = false
        }
      }
    }
    for (const m of source.matchAll(/<slot\b([^>]*)>/g)) {
      const slotName = /\bname=(["'])(.*?)\1/.exec(m[1]!)?.[2] ?? 'default'
      if (!slots.some(s => s.name === slotName)) slots.push({ name: slotName })
    }
    if (/\$slots\.default|useSlots\(\)/.test(source) && !slots.some(s => s.name === 'default')) slots.push({ name: 'default' })
  }
  else {
    const pascal = basename(file, extname(file))
    const decl = new RegExp(`(?:interface|type)\\s+${pascal}Props\\s*=?\\s*\\{`).exec(source)
      ?? /function\s+\w+\s*\(\s*(?:\{[^}]*\}\s*)?:\s*\{/.exec(source)
    if (decl) props = typeMembers(matchBalanced(source, decl.index + decl[0].length - 1) ?? '')
    if (props.children) {
      delete props.children
      slots.push({ name: 'default' })
    }
  }
  const description = /^\s*(?:<!--|\/\*\*)\s*([^\n*]+?)\s*(?:-->|\*\/|\n)/.exec(source)?.[1]
  return {
    name,
    kind: 'both',
    ...(description ? { description } : {}),
    ...(Object.keys(props).length ? { props } : {}),
    ...(slots.length ? { slots } : {}),
  }
}

function walk(dir: string, include: RegExp): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  }
  catch {
    return []
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path, include)
    return include.test(entry) ? [path] : []
  })
}

/** Scan directories and build the manifest (merged with `manifest`). */
export function scanComponents(root: string, options: ComponentsPluginOptions = {}): ComponentDef[] {
  const include = options.include ?? /\.(?:vue|tsx|jsx)$/
  const dirs = (options.dirs ?? ['components/content', 'app/components/content']).map(d => resolve(root, d))
  const byName = new Map<string, ComponentDef>()
  for (const dir of dirs) {
    for (const file of walk(dir, include)) {
      const rel = relative(dir, file)
      const name = options.name?.(file) ?? kebabCase(rel.replace(extname(rel), '').split(/[\\/]/).join('-'))
      byName.set(name, extractComponent(file, readFileSync(file, 'utf8'), name))
    }
  }
  for (const def of options.manifest ?? []) byName.set(def.name, { ...byName.get(def.name), ...def })
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Vite plugin exposing `virtual:comark-codemirror/components`. */
export function comarkCodemirrorComponents(options: ComponentsPluginOptions = {}): VitePluginLike {
  let root = process.cwd()
  return {
    name: 'comark-codemirror:components',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    resolveId: id => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return undefined
      return `export default ${JSON.stringify(scanComponents(root, options), null, 2)}\n`
    },
    configureServer(server) {
      const dirs = (options.dirs ?? ['components/content', 'app/components/content']).map(d => resolve(root, d))
      server.watcher.add(dirs)
      const invalidate = (file: string) => {
        if (!dirs.some(d => file.startsWith(d))) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod as never)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', invalidate)
      server.watcher.on('change', invalidate)
      server.watcher.on('unlink', invalidate)
    },
  }
}

export default comarkCodemirrorComponents

export type { ComponentDef, PropType }
