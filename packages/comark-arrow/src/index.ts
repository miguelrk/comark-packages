/**
 * comark-arrow: Comark plugin for ArrowJS sandboxed widgets.
 *
 * Claims ` ```arrow ` fences and `::arrow` / `::ArrowSandbox` directives,
 * emits a JSON-serializable `['ArrowSandbox', attrs]` AST node. The Vue
 * renderer (comark-arrow/vue) boots `@arrow-js/sandbox` client-side.
 *
 * @example
 * ```ts
 * import { parseMarkdown } from 'comark'
 * import arrow from 'comark-arrow'
 *
 * const tree = await parseMarkdown(content, { plugins: [arrow()] })
 * ```
 */

import { defineComarkPlugin } from 'comark'
import type {
  ComarkPluginFactory,
  ElementNode,
  MarkdownItPlugin,
  Node,
} from 'comark'
import { camelCase, textContent, visit } from 'comark/utils'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ArrowFallback = 'source' | 'placeholder' | 'caption'
export type ArrowStatus = 'ready' | 'pending'

/**
 * Options for the arrow plugin factory.
 *
 * `hostBridge` is intentionally absent — it is renderer-only (not serializable).
 */
export interface ArrowConfig {
  /** Set to `false` to disable the plugin. @default true */
  enabled?: boolean
  /** Default height for the sandbox host. */
  height?: string
  /** Default shadow DOM mode. @default true */
  shadowDom?: boolean
  /** Default debug logging inside the sandbox. @default false */
  debug?: boolean
  /** Default static-fallback mode for non-executing renderers. @default 'caption' */
  fallback?: ArrowFallback
  /**
   * When true (or when the getter returns true), the last arrow fence at EOF
   * is marked `status: 'pending'` so incomplete streaming frames never execute.
   *
   * Comark does not expose parse-call `streaming` to plugins; pass a getter
   * from the host (e.g. `() => isStreaming.value`) alongside `<Markdown :streaming>`.
   */
  streaming?: boolean | (() => boolean)
}

/** Attributes on a `['ArrowSandbox', attrs]` AST component node. */
export interface ArrowSandboxAttrs {
  source?: string
  css?: string
  status?: ArrowStatus
  height?: string
  shadowDom?: boolean
  debug?: boolean
  fallback?: ArrowFallback
  /** Binding path for `@comark/binding` (`:source="…"`). */
  ':source'?: string
  [k: string]: unknown
}

/** Keys contributed to `tree.meta` by the arrow plugin. */
export interface ArrowPluginMeta {
  arrow?: {
    /** Number of ArrowSandbox nodes in this document. */
    count: number
  }
}

export const ARROW_TAG = 'ArrowSandbox'
export const ARROW_DIRECTIVE = 'arrow'
export const ARROW_FENCE = 'arrow'
export const ARROW_CSS_FENCE = 'arrow-css'

// ---------------------------------------------------------------------------
// Fence info / props helpers (mermaid + flint patterns)
// ---------------------------------------------------------------------------

/**
 * Parse Comark fence leftover `meta` into key=value attrs.
 * Comark puts unrecognised info-string tokens into `pre.meta` as a raw string.
 */
export const parseFenceMeta = (meta: unknown): Record<string, string> => {
  if (typeof meta !== 'string' || !meta.trim()) return {}
  const attrs: Record<string, string> = {}
  const re = /([^\s=]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(meta)) !== null) {
    const key = match[1]
    if (!key) continue
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attrs
}

/** Parse `{key="value"}` props from a fence info suffix (mermaid-style). */
export const searchProps = (
  content: string,
  index = 0,
): { props: [string, string][]; index: number } | undefined => {
  const bracketPairs: Record<string, string> = {
    '[': ']',
    '{': '}',
    '(': ')',
  }
  const quotePairs: Record<string, string> = {
    "'": "'",
    '"': '"',
    '`': '`',
  }
  if (content[index] !== '{') return undefined
  if (content[index + 1] === '{') return undefined

  const props: [string, string][] = []
  index += 1

  const searchUntil = (str: string) => {
    const start = index
    while (index < content.length) {
      index += 1
      if (content[index] === '\\') index += 2
      if (str.includes(content[index]!)) break
    }
    return content.slice(start, index)
  }

  const searchString = (end: string) => searchUntil(end)

  const searchBracket = (end: string) => {
    while (index < content.length) {
      index++
      if (content[index]! in quotePairs) searchString(quotePairs[content[index]!]!)
      else if (content[index]! in bracketPairs)
        searchBracket(bracketPairs[content[index]!]!)
      else if (content[index] === end) return
    }
  }

  const searchValue = () => {
    const start = index
    if (content[index]! in bracketPairs) {
      searchBracket(bracketPairs[content[index]!]!)
      index += 1
      return content.slice(start, index)
    }
    if (content[index]! in quotePairs) {
      searchString(quotePairs[content[index]!]!)
      index += 1
      return content.slice(start, index)
    }
    return searchUntil(' }')
  }

  while (index < content.length) {
    if (content[index] === '\\') {
      index += 2
    } else if (content[index] === '}') {
      index += 1
      break
    } else if (content[index] === ' ') {
      index += 1
    } else if (content[index] === '.') {
      index += 1
      props.push(['class', searchUntil(' #.}')])
    } else if (content[index] === '#') {
      index += 1
      props.push(['id', searchUntil(' #.}')])
    } else {
      const start = index
      while (index < content.length) {
        index += 1
        if (' }='.includes(content[index]!)) break
      }
      const char = content[index]
      if (start !== index) {
        const key = content.slice(start, index).trim()
        if (char === '=') {
          index += 1
          props.push([key, searchValue()])
        } else {
          props.push([key, 'true'])
        }
      }
    }
  }

  for (const v of props) {
    if (v[1].match(/^(['"`]).*\1$/)) v[1] = v[1].slice(1, -1)
  }

  return { props, index }
}

const ATTR_ALIASES: Record<string, string> = {
  'shadow-dom': 'shadowDom',
  shadowdom: 'shadowDom',
}

const coerceAttrValue = (key: string, raw: string): unknown => {
  if (key === 'shadowDom' || key === 'debug') {
    if (raw === '' || raw === 'true') return true
    if (raw === 'false') return false
    return Boolean(raw)
  }
  return raw
}

/** Normalize kebab/camel fence attrs into ArrowSandboxAttrs fields. */
export const normalizeArrowAttrs = (
  raw: Record<string, unknown>,
  defaults: ArrowConfig = {},
): ArrowSandboxAttrs => {
  const out: ArrowSandboxAttrs = {}

  for (const [k, v] of Object.entries(raw)) {
    if (
      k === 'language' ||
      k === 'lang' ||
      k === 'class' ||
      k === 'className' ||
      k === 'meta' ||
      k === 'code' ||
      k === 'content' ||
      k === '$'
    ) {
      continue
    }
    const key = ATTR_ALIASES[k] ?? (k.includes('-') ? camelCase(k) : k)
    if (typeof v === 'string') {
      out[key] = coerceAttrValue(key, v)
    } else {
      out[key] = v
    }
  }

  if (out.height === undefined && defaults.height !== undefined) {
    out.height = defaults.height
  }
  if (out.shadowDom === undefined) {
    out.shadowDom = defaults.shadowDom ?? true
  }
  if (out.debug === undefined && defaults.debug !== undefined) {
    out.debug = defaults.debug
  }
  if (out.fallback === undefined) {
    out.fallback = defaults.fallback ?? 'caption'
  }

  return out
}

export const resolvePath = (
  path: string,
  data: Record<string, unknown>,
): unknown =>
  path.split('.').reduce<unknown>((obj, key) => {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return undefined
    }
    return (obj as Record<string, unknown>)[key]
  }, data)

const isStreamingEnabled = (config: ArrowConfig): boolean => {
  const s = config.streaming
  if (typeof s === 'function') return Boolean(s())
  return Boolean(s)
}

// ---------------------------------------------------------------------------
// Node detection
// ---------------------------------------------------------------------------

const fenceLang = (info: string | undefined): string => {
  if (!info) return ''
  return info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
}

const isArrowFenceInfo = (info: string | undefined): boolean => {
  const lang = fenceLang(info)
  return lang === ARROW_FENCE
}

const isFencedArrowCssBlock = (node: Node): boolean => {
  if (!Array.isArray(node)) return false
  const [tag, attrs] = node as ElementNode
  if (tag !== 'pre') return false
  const lang = String(attrs?.language ?? attrs?.lang ?? '')
  if (lang === ARROW_CSS_FENCE) return true
  const children = (node as unknown[]).slice(2) as Node[]
  return children.some((child) => {
    if (!Array.isArray(child)) return false
    const [cTag, cAttrs] = child as ElementNode
    if (cTag !== 'code') return false
    const cls = String(cAttrs?.class ?? cAttrs?.className ?? '')
    return cls.includes(`language-${ARROW_CSS_FENCE}`)
  })
}

const isFencedArrowBlock = (node: Node): boolean => {
  if (!Array.isArray(node)) return false
  const [tag, attrs] = node as ElementNode
  if (tag !== 'pre') return false
  const lang = String(attrs?.language ?? attrs?.lang ?? '')
  if (lang === ARROW_FENCE) return true
  const children = (node as unknown[]).slice(2) as Node[]
  return children.some((child) => {
    if (!Array.isArray(child)) return false
    const [cTag, cAttrs] = child as ElementNode
    if (cTag !== 'code') return false
    const cls = String(cAttrs?.class ?? cAttrs?.className ?? '')
    return cls.includes(`language-${ARROW_FENCE}`) && !cls.includes(`language-${ARROW_CSS_FENCE}`)
  })
}

const isArrowDirective = (node: Node): boolean => {
  if (!Array.isArray(node)) return false
  const tag = String((node as ElementNode)[0])
  return tag === ARROW_DIRECTIVE || tag === ARROW_TAG
}

const isArrowNode = (node: Node): boolean =>
  isArrowDirective(node) || isFencedArrowBlock(node)

const extractFencedSource = (
  el: ElementNode,
): { raw: string; attrs: Record<string, unknown> } => {
  const preAttrs = el[1] as Record<string, unknown>
  const metaAttrs = parseFenceMeta(preAttrs.meta)

  if (typeof preAttrs.code === 'string') {
    const { meta: _meta, code: _code, ...rest } = preAttrs
    return { raw: preAttrs.code, attrs: { ...metaAttrs, ...rest } }
  }

  const children = (el as unknown as unknown[]).slice(2) as Node[]
  const raw = children.map((c) => textContent(c)).join('')
  const codeChild = children.find(
    (c) => Array.isArray(c) && String((c as ElementNode)[0]) === 'code',
  )
  const codeAttrs = codeChild
    ? ((codeChild as ElementNode)[1] as Record<string, unknown>)
    : {}
  const { meta: _meta, ...preRest } = preAttrs
  return {
    raw: raw.endsWith('\n') ? raw.slice(0, -1) : raw,
    attrs: { ...metaAttrs, ...codeAttrs, ...preRest },
  }
}

const makeArrowNode = (attrs: ArrowSandboxAttrs): ElementNode =>
  [ARROW_TAG, attrs] as unknown as ElementNode

// ---------------------------------------------------------------------------
// markdown-it: claim ```arrow fences before shiki/rangi
// ---------------------------------------------------------------------------

const markdownItArrow = (md: {
  core: { ruler: { after: (name: string, rule: string, fn: (state: { tokens: Array<{
    type: string
    info?: string
    tag?: string
    content?: string
    attrJoin?: (k: string, v: string) => void
    attrSet?: (k: string, v: string) => void
  }> }) => void) => void } }
}, config: ArrowConfig) => {
  md.core.ruler.after('block', 'comark-arrow-replace-pre', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence') continue
      if (!isArrowFenceInfo(token.info)) continue

      let info = (token.info ?? '').slice(ARROW_FENCE.length).trim()
      let props: [string, string][] = []

      const curlyBraceIndex = info.indexOf('{')
      if (curlyBraceIndex !== -1) {
        const result = searchProps(info.slice(curlyBraceIndex))
        if (result) {
          props = result.props
          info = info.slice(0, curlyBraceIndex) + info.slice(curlyBraceIndex + result.index)
        }
      }

      const leftover = parseFenceMeta(info.trim())
      const merged: Record<string, unknown> = { ...leftover }
      for (const [k, v] of props) merged[k] = v

      const attrs = normalizeArrowAttrs(merged, config)
      attrs.source = token.content?.endsWith('\n')
        ? token.content.slice(0, -1)
        : (token.content ?? '')
      attrs.status = 'ready'

      token.type = ARROW_TAG
      token.tag = ARROW_TAG
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined) continue
        token.attrSet?.(k, typeof v === 'boolean' ? String(v) : String(v))
      }
      token.info = ''
    }
  })
}

// ---------------------------------------------------------------------------
// Streaming helpers
// ---------------------------------------------------------------------------

/** True for a CommonMark fence opener/closer line (``` or ~~~, length ≥ 3). */
const isFenceLine = (line: string): boolean => {
  let i = 0
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++
  const ch = line[i]
  if (ch !== '`' && ch !== '~') return false
  let n = 0
  while (i + n < line.length && line[i + n] === ch) n++
  return n >= 3
}

/**
 * Comark autoClose does not close unterminated code fences — markdown-it
 * consumes them to EOF. While `streaming` is on, an open ```arrow / ```arrow-css
 * fence at EOF must stay non-executable.
 */
export const hasUnclosedArrowFence = (markdown: string): boolean => {
  let open: 'arrow' | 'arrow-css' | 'other' | null = null
  for (const line of markdown.split('\n')) {
    if (!isFenceLine(line)) continue
    let i = 0
    while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++
    const ch = line[i]!
    let n = 0
    while (i + n < line.length && line[i + n] === ch) n++
    const info = line.slice(i + n).trim()
    const lang = info.split(/\s+/)[0]?.toLowerCase() ?? ''
    if (open) {
      open = null
    } else if (lang === ARROW_FENCE) {
      open = 'arrow'
    } else if (lang === ARROW_CSS_FENCE) {
      open = 'arrow-css'
    } else {
      open = 'other'
    }
  }
  return open === 'arrow' || open === 'arrow-css'
}

// ---------------------------------------------------------------------------
// post: rewrite leftover pre / directives, pair css, set status
// ---------------------------------------------------------------------------

const collectArrowSandboxRefs = (nodes: Node[]): ElementNode[] => {
  const found: ElementNode[] = []
  const walk = (list: Node[]) => {
    for (const n of list) {
      if (!Array.isArray(n)) continue
      const el = n as ElementNode
      if (String(el[0]) === ARROW_TAG) found.push(el)
      walk(el.slice(2) as Node[])
    }
  }
  walk(nodes)
  return found
}

const pairCssBlocks = (nodes: Node[]): void => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node || !Array.isArray(node)) continue
    const el = node as ElementNode

    if (String(el[0]) === ARROW_TAG) {
      const next = nodes[i + 1]
      if (next && isFencedArrowCssBlock(next)) {
        const { raw } = extractFencedSource(next as ElementNode)
        const attrs = el[1] as ArrowSandboxAttrs
        attrs.css = raw
        nodes.splice(i + 1, 1)
      }
    }

    if (el.length > 2) {
      pairCssBlocks(el.slice(2) as Node[])
    }
  }
}

const processArrowNode = (
  el: ElementNode,
  frontmatter: Record<string, unknown>,
  config: ArrowConfig,
): ElementNode | undefined => {
  const tag = String(el[0])

  if (tag === ARROW_TAG) {
    const attrs = normalizeArrowAttrs(
      { ...(el[1] as Record<string, unknown>) },
      config,
    )
    if (typeof (el[1] as ArrowSandboxAttrs).source === 'string') {
      attrs.source = (el[1] as ArrowSandboxAttrs).source
    }
    if (typeof (el[1] as ArrowSandboxAttrs).css === 'string') {
      attrs.css = (el[1] as ArrowSandboxAttrs).css
    }
    attrs.status = attrs.status ?? 'ready'
    return makeArrowNode(attrs)
  }

  if (tag === ARROW_DIRECTIVE) {
    const nodeAttrs = el[1] as Record<string, unknown>
    const attrs = normalizeArrowAttrs({ ...nodeAttrs }, config)

    const bound = nodeAttrs[':source']
    if (typeof bound === 'string') {
      const resolved = resolvePath(bound, frontmatter)
      if (resolved !== undefined && typeof resolved === 'string') {
        attrs.source = resolved
      } else {
        attrs[':source'] = bound
      }
    } else if (typeof nodeAttrs.source === 'string') {
      attrs.source = nodeAttrs.source
    }

    attrs.status = 'ready'
    return makeArrowNode(attrs)
  }

  // Leftover fenced pre[language=arrow]
  const { raw, attrs: blockAttrs } = extractFencedSource(el)
  const attrs = normalizeArrowAttrs(blockAttrs, config)
  attrs.source = raw
  attrs.status = 'ready'
  return makeArrowNode(attrs)
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

const plugin: ComarkPluginFactory<ArrowConfig, ArrowPluginMeta> =
  defineComarkPlugin<ArrowConfig, ArrowPluginMeta>((config = {}) => {
    const enabled = config.enabled ?? true

    return {
      name: 'comark-arrow',

      markdownItPlugins: enabled
        ? ([
            ((md: unknown) =>
              markdownItArrow(
                md as Parameters<typeof markdownItArrow>[0],
                config,
              )) as unknown as MarkdownItPlugin,
          ] as MarkdownItPlugin[])
        : [],

      post(state) {
        if (!enabled) return

        const frontmatter = (state.tree.frontmatter ?? {}) as Record<
          string,
          unknown
        >

        visit(state.tree, isArrowNode, (node) => {
          try {
            return processArrowNode(node as ElementNode, frontmatter, config)
          } catch (err) {
            console.warn(
              `[comark-arrow] Failed to process node: ${err instanceof Error ? err.message : String(err)}`,
            )
            return undefined
          }
        })

        pairCssBlocks(state.tree.nodes)

        const sandboxes = collectArrowSandboxRefs(state.tree.nodes)
        const streaming = isStreamingEnabled(config)

        if (streaming && sandboxes.length > 0 && hasUnclosedArrowFence(state.markdown)) {
          const last = sandboxes[sandboxes.length - 1]!
          const attrs = last[1] as ArrowSandboxAttrs
          const isDirectiveOnly =
            attrs[':source'] !== undefined &&
            (attrs.source === undefined || attrs.source === '')

          if (!isDirectiveOnly) {
            attrs.status = 'pending'
          }
        }

        if (sandboxes.length > 0) {
          state.tree.meta = {
            ...state.tree.meta,
            arrow: { count: sandboxes.length },
          }
        }
      },
    }
  })

export default plugin
