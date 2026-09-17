/**
 * Vega plugin for Comark.
 *
 * ## Entry points
 *
 * ### 1 — Fenced `vega` / `vega-lite` code block (literal / static)
 *
 * ```vega
 * { "$schema": "…/vega-lite/v6.json", "mark": "bar", … }
 * ```
 *
 * The JSON inside the fence is never passed through Comark's binding or MDC
 * attribute pipelines, so curly braces are safe. The block is replaced with
 * a `<Vega>` component node carrying the parsed spec as a literal prop.
 *
 * ### 2 — `::vega` component directive (dynamic / bound)
 *
 * ```md
 * ::vega{:spec="report.chart" engine="vega-lite"}
 * ```
 *
 * Plain `prop="value"` attrs remain literal strings; `:prop="expression"` attrs
 * are preserved verbatim for `@comark/binding` to resolve against
 * frontmatter / runtime data at render time. The node produced is the same
 * `<Vega>` shape as the fenced entry point.
 *
 * ### Shared render component
 *
 * Both entry points emit `['Vega', { spec?, ':spec'?, engine?, … }]`. Import the
 * shipped Vue renderer from `comark-vega/vue`:
 *
 * ```ts
 * import vega, { Vega } from 'comark-vega/vue'
 * // <Markdown :plugins="[vega()]" :components="{ Vega }" />
 * ```
 *
 * Prefer component/render-time for interactive apps. Parse-time SVG/img via
 * `::vl` / `::vg` / `::chart` / mark shortcuts remains an explicit opt-in for
 * static docs, PDF, and no-runtime environments.
 *
 * ## Existing inline-SVG directives (unchanged)
 *
 * `::chart`, `::vl` / `::vega-lite`, `::vg`, and `::chart-*` mark shortcuts
 * continue to render inline SVG at parse time exactly as before.
 * `::vega` is no longer an alias for the Vega inline-SVG engine; use `::vg` for that.
 *
 * @example
 * ```ts
 * import { parseMarkdown } from 'comark'
 * import vega from 'comark-vega'
 *
 * const doc = await parseMarkdown(content, { plugins: [vega()] })
 * ```
 *
 * @see https://vega.github.io/vega/
 * @see https://vega.github.io/vega-lite/
 */

import { defineComarkPlugin } from 'comark'
import type { ComarkPluginFactory, ElementNode, Node } from 'comark'
import { visitAsync, textContent } from 'comark/utils'
import { svgToNodes } from './svgToNodes.ts'

export { svgToNodes }
export { mountVegaView } from './mountView.ts'
export type { MountVegaViewOptions, MountedVegaView } from './mountView.ts'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Chart rendering engine. */
export type ChartEngine = 'vega-lite' | 'vega'

/** Output mode for inline-SVG directives. */
export type VegaOutput = 'svg' | 'img' | 'png'

/**
 * Options for the vega plugin factory.
 *
 * All keys under `vega` are merged as global defaults for every inline-SVG
 * directive. Per-directive attrs always take precedence.
 * These defaults have no effect on `<Vega>` component nodes.
 */
export interface VegaConfig {
  vega?: {
    /** Rendering engine default for inline-SVG directives. */
    engine?: ChartEngine
    /** Output format default. Defaults to `'svg'`. */
    output?: VegaOutput
    /** Chart width in pixels. */
    width?: number
    /** Chart height in pixels. */
    height?: number
    /** Scale factor for rasterisation (PNG). Defaults to `1`. */
    scaleFactor?: number
    /** Vega/Vega-Lite config object merged into the spec config. */
    config?: Record<string, unknown>
  }
}

/**
 * Attributes on a `['Vega', attrs]` AST component node.
 *
 * Use the shipped Vue renderer from `comark-vega/vue`, or map these props in a
 * custom React/Svelte component. Both fenced-block and `::vega` paths converge here.
 *
 * With `@comark/binding`, `:spec` expressions resolve to the `spec` prop before
 * the component mounts.
 */
export interface VegaNodeAttrs {
  /** Literal Vega or Vega-Lite spec (from fenced block or literal attr). */
  spec?: Record<string, unknown>
  /** Inferred or explicit engine. */
  engine?: ChartEngine
  /** Chart width in pixels. */
  width?: number
  /** Chart height in pixels. */
  height?: number
  /** Output format hint for SSR-capable components. */
  output?: VegaOutput
  /** Passthrough for binding expressions (:spec, :width, …). */
  [k: string]: unknown
}

// ---------------------------------------------------------------------------
// Inline-SVG directive registry (existing behaviour, unchanged)
// ---------------------------------------------------------------------------

/**
 * Mark-shortcut tags — inject the corresponding `mark` into a Vega-Lite spec
 * when the spec body omits it.
 */
const MARK_SHORTCUTS = new Map<string, string>([
  ['chart-arc', 'arc'],
  ['chart-area', 'area'],
  ['chart-bar', 'bar'],
  ['chart-boxplot', 'boxplot'],
  ['chart-circle', 'circle'],
  ['chart-errorband', 'errorband'],
  ['chart-errorbar', 'errorbar'],
  ['chart-geoshape', 'geoshape'],
  ['chart-image', 'image'],
  ['chart-line', 'line'],
  ['chart-point', 'point'],
  ['chart-rect', 'rect'],
  ['chart-rule', 'rule'],
  ['chart-square', 'square'],
  ['chart-text', 'text'],
  ['chart-tick', 'tick'],
  ['chart-trail', 'trail'],
])

/** Tags that produce inline SVG at parse time (existing behaviour). */
const INLINE_TAGS = new Set([
  'chart',
  'vl',
  'vega-lite',
  'vg',
  ...MARK_SHORTCUTS.keys(),
])

/**
 * Tags that produce a `<Vega>` component AST node.
 * `::vega` is the single component-syntax directive; it no longer acts as
 * an inline-SVG alias for the full Vega engine (use `::vg` for that).
 */
const COMPONENT_DIRECTIVE_TAGS = new Set(['vega'])

/** Union of all directive tags handled by this plugin. */
const ALL_DIRECTIVE_TAGS = new Set([...INLINE_TAGS, ...COMPONENT_DIRECTIVE_TAGS])

// ---------------------------------------------------------------------------
// Fenced code-block detection helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` for `pre` elements whose first `code` child carries a
 * `class` containing `language-vega` (matches both `language-vega` and
 * `language-vega-lite`).
 */
const isVegaFence = (node: Node): boolean => {
  if (!Array.isArray(node)) return false
  const el = node as ElementNode
  if (String(el[0]) !== 'pre') return false
  const children = (el as unknown as unknown[]).slice(2) as Node[]
  for (const child of children) {
    if (!Array.isArray(child)) continue
    const childEl = child as ElementNode
    if (String(childEl[0]) !== 'code') continue
    const cls = String((childEl[1] as Record<string, unknown>)?.['class'] ?? '')
    if (cls.includes('language-vega')) return true
  }
  return false
}

/**
 * Extracts the parsed spec and language tag from a fenced Vega code block.
 * Returns `undefined` when the JSON spec cannot be parsed.
 */
const extractFenceSpec = (
  preNode: ElementNode,
): { spec: Record<string, unknown>; lang: string } | undefined => {
  const children = (preNode as unknown as unknown[]).slice(2) as Node[]
  for (const child of children) {
    if (!Array.isArray(child)) continue
    const childEl = child as ElementNode
    if (String(childEl[0]) !== 'code') continue
    const cls = String((childEl[1] as Record<string, unknown>)?.['class'] ?? '')
    const match = cls.match(/language-(vega(?:-lite)?)/)
    if (!match) continue
    const lang = match[1] ?? 'vega'
    const text = textContent(child as Node).trim()
    const spec = tryParseJSON(text)
    if (spec) return { spec, lang }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Option coercion (shared)
// ---------------------------------------------------------------------------

const RESERVED_INLINE_ATTR_KEYS = new Set(['output', 'engine', '$', 'class', 'id', 'spec'])

/**
 * Coerce a raw string attribute value to the appropriate JavaScript type:
 * boolean, number, JSON object/array, or string.
 */
export const coerceValue = (v: unknown): unknown => {
  if (typeof v !== 'string') return v
  if (v === 'true') return true
  if (v === 'false') return false
  const n = Number(v)
  if (v !== '' && !Number.isNaN(n)) return n
  if ((v.startsWith('{') || v.startsWith('[')) && (v.endsWith('}') || v.endsWith(']'))) {
    try { return JSON.parse(v) } catch { /* keep as string */ }
  }
  return v
}

/**
 * Parse a JSON string into an object.
 * Returns `undefined` if parsing fails or input is not a JSON object/array.
 */
const tryParseJSON = (raw: string): Record<string, unknown> | undefined => {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try { return JSON.parse(trimmed) as Record<string, unknown> } catch { return undefined }
}

// ---------------------------------------------------------------------------
// Spec extraction (for inline-SVG directives)
// ---------------------------------------------------------------------------

/**
 * Extract the chart spec from a directive's `spec=` attr or code-fenced block body.
 * Code-fenced content is used because Comark interprets bare `{…}` in block
 * directive bodies as directive attribute syntax.
 */
const extractSpec = (
  attrs: Record<string, unknown>,
  children: Node[],
): Record<string, unknown> | undefined => {
  if (typeof attrs['spec'] === 'string') {
    const parsed = tryParseJSON(attrs['spec'])
    if (parsed) return parsed
  }
  for (const child of children) {
    if (!Array.isArray(child)) continue
    const tag = (child as ElementNode)[0]
    if (tag === 'pre' || tag === 'code') {
      const code = textContent(child as Node).trim()
      const parsed = tryParseJSON(code)
      if (parsed) return parsed
    }
  }
  const body = children.map((c) => textContent(c)).join('').trim()
  return body.length > 0 ? tryParseJSON(body) : undefined
}

// ---------------------------------------------------------------------------
// Engine detection
// ---------------------------------------------------------------------------

/**
 * Infer the rendering engine from the inline-SVG directive tag.
 * Returns `undefined` for `::chart` (auto-detect from spec content).
 */
const engineFromTag = (tag: string): ChartEngine | undefined => {
  if (tag === 'vl' || tag === 'vega-lite' || MARK_SHORTCUTS.has(tag)) return 'vega-lite'
  if (tag === 'vg') return 'vega'
  // Note: `::vega` is now a component directive, not an engine alias.
  return undefined
}

/**
 * Infer the rendering engine from spec content:
 * 1. `$schema` URL — `vega-lite` → vega-lite, otherwise vega.
 * 2. Structural keys — `mark`/`layer`/… → vega-lite; `marks`/`signals`/… → vega.
 * 3. Default: vega-lite.
 */
const detectEngine = (spec: Record<string, unknown>): ChartEngine => {
  const schema = spec['$schema']
  if (typeof schema === 'string') {
    if (schema.includes('vega-lite')) return 'vega-lite'
    if (schema.includes('vega')) return 'vega'
  }
  if (
    spec['mark'] !== undefined ||
    spec['layer'] !== undefined ||
    spec['hconcat'] !== undefined ||
    spec['vconcat'] !== undefined ||
    spec['facet'] !== undefined ||
    spec['spec'] !== undefined
  ) return 'vega-lite'
  if (spec['marks'] !== undefined || spec['signals'] !== undefined || spec['scales'] !== undefined) return 'vega'
  return 'vega-lite'
}

// ---------------------------------------------------------------------------
// Render options (for inline-SVG directives)
// ---------------------------------------------------------------------------

interface RenderOpts {
  width?: number
  height?: number
  scaleFactor?: number
  config?: Record<string, unknown>
}

const buildRenderOpts = (
  attrs: Record<string, unknown>,
  defaults: Record<string, unknown>,
): RenderOpts => {
  const pick = (key: string): unknown => attrs[key] ?? defaults[key]
  const w = coerceValue(pick('width') as unknown)
  const h = coerceValue(pick('height') as unknown)
  const s = coerceValue(pick('scaleFactor') as unknown)
  const cfg = (attrs['config'] ?? defaults['config']) as Record<string, unknown> | undefined
  return {
    width: typeof w === 'number' ? w : undefined,
    height: typeof h === 'number' ? h : undefined,
    scaleFactor: typeof s === 'number' ? s : undefined,
    config: cfg,
  }
}

// ---------------------------------------------------------------------------
// Adapter interface and implementations (for inline-SVG directives)
// ---------------------------------------------------------------------------

interface ChartAdapter {
  readonly engine: ChartEngine
  toSVG(spec: Record<string, unknown>, opts: RenderOpts): Promise<string>
  toCanvas(spec: Record<string, unknown>, opts: RenderOpts): Promise<{ toDataURL(): string; toBuffer?(): Buffer }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VegaMod = Record<string, any>

let _vegaMod: VegaMod | null = null
let _vegaAttempted = false

const loadVega = async (): Promise<VegaMod | null> => {
  if (_vegaAttempted) return _vegaMod
  _vegaAttempted = true
  try {
    _vegaMod = (await import('vega')) as VegaMod
    return _vegaMod
  } catch {
    console.warn(
      '[comark-vega] Peer dependency "vega" is not installed. ' +
        'Run `npm install vega` to enable chart directives.',
    )
    return null
  }
}

/**
 * Adapter for full Vega specifications.
 *
 * Parses the spec with `vega.parse()`, instantiates a headless `vega.View`
 * with `renderer: 'none'`, and calls `view.toSVG()` or `view.toCanvas()`.
 */
const vegaAdapter: ChartAdapter = {
  engine: 'vega',

  async toSVG(spec, opts) {
    const vega = await loadVega()
    if (!vega) throw new Error('"vega" is not installed')
    const runtime = vega.parse(spec, opts.config)
    const view: VegaMod = new vega.View(runtime, { renderer: 'none' })
    if (opts.width != null) view.width(opts.width)
    if (opts.height != null) view.height(opts.height)
    return view.toSVG(opts.scaleFactor ?? 1) as Promise<string>
  },

  async toCanvas(spec, opts) {
    const vega = await loadVega()
    if (!vega) throw new Error('"vega" is not installed')
    const runtime = vega.parse(spec, opts.config)
    const view: VegaMod = new vega.View(runtime, { renderer: 'none' })
    if (opts.width != null) view.width(opts.width)
    if (opts.height != null) view.height(opts.height)
    return view.toCanvas(opts.scaleFactor ?? 1) as Promise<{ toDataURL(): string; toBuffer?(): Buffer }>
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VegaLiteMod = Record<string, any>

let _vegaLiteMod: VegaLiteMod | null = null
let _vegaLiteAttempted = false

const loadVegaLite = async (): Promise<VegaLiteMod | null> => {
  if (_vegaLiteAttempted) return _vegaLiteMod
  _vegaLiteAttempted = true
  try {
    _vegaLiteMod = (await import('vega-lite')) as VegaLiteMod
    return _vegaLiteMod
  } catch {
    console.warn(
      '[comark-vega] Peer dependency "vega-lite" is not installed. ' +
        'Run `npm install vega-lite` to enable Vega-Lite directives.',
    )
    return null
  }
}

/**
 * Adapter for Vega-Lite specifications.
 *
 * Compiles the spec via `vega-lite.compile()`, injecting width/height before
 * compilation for correct signal resolution, then delegates to `vegaAdapter`.
 */
const vegaLiteAdapter: ChartAdapter = {
  engine: 'vega-lite',

  async toSVG(spec, opts) {
    const compiled = await compileVegaLite(spec, opts)
    return vegaAdapter.toSVG(compiled, opts)
  },

  async toCanvas(spec, opts) {
    const compiled = await compileVegaLite(spec, opts)
    return vegaAdapter.toCanvas(compiled, opts)
  },
}

const compileVegaLite = async (
  spec: Record<string, unknown>,
  opts: RenderOpts,
): Promise<Record<string, unknown>> => {
  const vl = await loadVegaLite()
  if (!vl) throw new Error('"vega-lite" is not installed')
  const specWithDims: Record<string, unknown> = {
    ...spec,
    ...(opts.width != null ? { width: opts.width } : {}),
    ...(opts.height != null ? { height: opts.height } : {}),
  }
  const result = vl.compile(specWithDims, { config: opts.config }) as { spec: Record<string, unknown> }
  return result.spec
}

const ADAPTERS: Record<ChartEngine, ChartAdapter> = {
  'vega-lite': vegaLiteAdapter,
  'vega': vegaAdapter,
}

// ---------------------------------------------------------------------------
// Node builders
// ---------------------------------------------------------------------------

const makeImgNode = (src: string, alt: string): ElementNode =>
  ['img', { src, alt, $: { html: 1, void: 1 } }] as unknown as ElementNode

const makeFallbackNode = (tag: string, message: string): ElementNode => [
  'pre',
  { class: `vega vega-error vega-${tag}` },
  ['code', {}, message],
]

const svgToDataURI = (svg: string): string =>
  `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`

// ---------------------------------------------------------------------------
// <Vega> component node builders
// ---------------------------------------------------------------------------

/**
 * Produce a `['Vega', attrs]` component AST node from a fenced code block.
 *
 * Engine is resolved as:
 * 1. `$schema` in spec (most reliable)
 * 2. Code-fence language tag (`vega` vs `vega-lite`)
 */
const makeFenceVegaNode = (preNode: ElementNode): ElementNode | undefined => {
  const result = extractFenceSpec(preNode)
  if (!result) return undefined

  const { spec, lang } = result
  const engine: ChartEngine =
    typeof spec['$schema'] === 'string'
      ? detectEngine(spec)
      : lang === 'vega-lite' ? 'vega-lite' : 'vega'

  return ['Vega', { spec, engine } satisfies VegaNodeAttrs] as unknown as ElementNode
}

/**
 * Produce a `['Vega', attrs]` component AST node from a `::vega` directive.
 *
 * Binding attrs (`:prop="expr"`) are preserved verbatim for `@comark/binding`
 * to resolve at render time. Plain attrs (`prop="value"`) are coerced.
 * A code-fenced spec in the block body is extracted as a literal `spec` prop,
 * but only when no `:spec` binding is already present.
 */
const makeDirectiveVegaNode = (
  attrs: Record<string, unknown>,
  children: Node[],
): ElementNode => {
  const out: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(attrs)) {
    // Skip internal Comark flags
    if (k === '$' || k === 'class' || k === 'id') continue
    if (k.startsWith(':')) {
      // Binding expression — preserve for @comark/binding to resolve at render time.
      // Plain string values are kept as-is (the expression string, not its result).
      out[k] = v
    } else {
      out[k] = coerceValue(v)
    }
  }

  // When no :spec binding is present, look for a literal spec in the block body.
  if (out[':spec'] === undefined && out['spec'] === undefined) {
    const bodySpec = extractSpec(attrs, children)
    if (bodySpec !== undefined) {
      out['spec'] = bodySpec
      if (out['engine'] === undefined) out['engine'] = detectEngine(bodySpec)
    }
  }

  return ['Vega', out satisfies VegaNodeAttrs] as unknown as ElementNode
}

// ---------------------------------------------------------------------------
// Inline-SVG generator (for existing ::chart / ::vl / ::vg / ::chart-* directives)
// ---------------------------------------------------------------------------

const generate = async (
  tag: string,
  attrs: Record<string, unknown>,
  children: Node[],
  defaults: Record<string, unknown>,
  output: VegaOutput,
): Promise<Node | undefined> => {
  let spec = extractSpec(attrs, children)

  const presetMark = MARK_SHORTCUTS.get(tag)
  if (presetMark) {
    spec = spec ?? {}
    if (spec['mark'] === undefined) spec = { mark: presetMark, ...spec }
  }

  if (spec === undefined) {
    console.warn(`[comark-vega] ${tag} has no chart spec. Provide it as block body JSON or spec= attr.`)
    return undefined
  }

  const engineAttr = String(attrs['engine'] ?? defaults['engine'] ?? '')
  const engineTag = engineFromTag(tag)
  const engine: ChartEngine =
    (engineAttr === 'vega-lite' || engineAttr === 'vega' ? engineAttr : undefined) ??
    engineTag ??
    detectEngine(spec)

  const adapter = ADAPTERS[engine]
  const opts = buildRenderOpts(attrs, defaults)

  if (output === 'png') {
    try {
      const canvas = await adapter.toCanvas(spec, opts)
      return makeImgNode(canvas.toDataURL(), `vega-${tag}`)
    } catch (err) {
      console.warn(
        `[comark-vega] PNG output failed (is the "canvas" peer dependency installed?): ` +
          `${err instanceof Error ? err.message : String(err)}. Falling back to SVG.`,
      )
    }
  }

  const svg = await adapter.toSVG(spec, opts)
  if (output === 'img') return makeImgNode(svgToDataURI(svg), `vega-${tag}`)

  const nodes = svgToNodes(svg)
  return nodes.length > 0 ? (nodes[0] as ElementNode) : undefined
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the vega plugin for Comark.
 *
 * **Entry point 1 — fenced `vega` / `vega-lite` code block (literal spec):**
 * ```vega
 * { "$schema": "…", "mark": "bar", … }
 * ```
 * Produces a `['Vega', { spec: {…}, engine: 'vega-lite' }]` component node.
 *
 * **Entry point 2 — `::vega` component directive (dynamic / bound spec):**
 * ```md
 * ::vega{:spec="report.chart" engine="vega-lite"}
 * ```
 * Produces a `['Vega', { ':spec': 'report.chart', engine: 'vega-lite' }]` node.
 * Binding attrs (`:prop="expr"`) are preserved for `@comark/binding`.
 *
 * Both entry points produce nodes with the same `['Vega', VegaNodeAttrs]` shape.
 *
 * **Inline-SVG directives (existing, unchanged):**
 *
 * | Tag | Engine |
 * |-----|--------|
 * | `::chart` | auto-detect |
 * | `::vl` / `::vega-lite` | Vega-Lite |
 * | `::vg` | Vega |
 * | `::chart-bar`, `::chart-line`, … | Vega-Lite + preset mark |
 */
const plugin: ComarkPluginFactory<VegaConfig> = defineComarkPlugin<VegaConfig>((config = {}) => ({
  name: 'vega',

  async post(state) {
    const fmVega = (state.tree.frontmatter?.vega as Record<string, unknown> | undefined) ?? {}
    const globalDefaults: Record<string, unknown> = { ...config.vega, ...fmVega }
    const outputDefault = String(globalDefaults['output'] ?? 'svg') as VegaOutput

    // -----------------------------------------------------------------------
    // Pass 1: fenced `vega` / `vega-lite` code blocks → <Vega> component node
    //
    // Code-fence content is opaque static text — Comark never runs it through
    // the binding pipeline — so `{…}` JSON is always safe here.
    // -----------------------------------------------------------------------
    await visitAsync(
      state.tree,
      isVegaFence,
      async (node) => makeFenceVegaNode(node as ElementNode) ?? undefined,
    )

    // -----------------------------------------------------------------------
    // Pass 2: directive handlers
    // -----------------------------------------------------------------------
    await visitAsync(
      state.tree,
      (node) => Array.isArray(node) && ALL_DIRECTIVE_TAGS.has(String((node as ElementNode)[0])),
      async (node) => {
        const el = node as ElementNode
        const tag = String(el[0])
        const attrs = el[1] as Record<string, unknown>
        const children = (el as unknown as unknown[]).slice(2) as Node[]

        // ::vega → <Vega> component node (bindings preserved, no SVG rendering)
        if (COMPONENT_DIRECTIVE_TAGS.has(tag)) {
          return makeDirectiveVegaNode(attrs, children)
        }

        // ::chart, ::vl, ::vg, ::chart-* → inline SVG (existing behaviour)
        const output = String(attrs['output'] ?? globalDefaults['output'] ?? outputDefault) as VegaOutput

        const resolvedAttrs: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(attrs)) {
          if (k.startsWith(':')) {
            // Try JSON-parsing `:key` values; skip those that are runtime expressions.
            if (typeof v === 'string') {
              try { resolvedAttrs[k.slice(1)] = JSON.parse(v) } catch { /* skip */ }
            }
          } else if (!RESERVED_INLINE_ATTR_KEYS.has(k)) {
            resolvedAttrs[k] = coerceValue(v)
          } else {
            resolvedAttrs[k] = v
          }
        }

        try {
          return await generate(tag, resolvedAttrs, children, globalDefaults, output)
        } catch (err) {
          console.warn(
            `[comark-vega] Failed to render ${tag}: ${err instanceof Error ? err.message : String(err)}`,
          )
          const specPreview = children.map((c) => textContent(c)).join('').trim().slice(0, 120)
          return makeFallbackNode(tag, specPreview || tag)
        }
      },
    )
  },
}))

export default plugin
