/**
 * comark-flint-chart: Comark plugin to compile Flint specs to Vega-Lite
 * (and other backends) at parse time using the `flint-chart` peer dependency.
 *
 * Supports two entry-point syntaxes that both converge on a single `<Flint>`
 * render node:
 *
 * 1. Fenced code block (literal, static spec):
 *    ```flint backend="vegalite" theme="economist"
 *    { "chart_spec": { "chartType": "Bar Chart", ... } }
 *    ```
 *
 *    Comark stores leftover info-string tokens in `pre.meta`. Use key=value
 *    tokens (`backend="…" theme="…"`). Curly braces are line highlights. *
 * 2. Component directive (bound spec from frontmatter/data):
 *    ::flint{:spec="dashboard.kpiChart" backend="echarts"}
 *
 * The plugin compiles the Flint `ChartAssemblyInput` to the target backend
 * spec at parse time and stores it in a `<Flint>` component node. When
 * `vega` + `vega-lite` (for the `vegalite` backend) or `echarts` (for the
 * `echarts` backend) are installed as optional peers and `output="svg"` is
 * set, the plugin renders inline SVG at parse time instead.
 *
 * Frontmatter defaults (applied before per-directive/block attrs):
 * ```yaml
 * ---
 * flint:
 *   backend: vegalite
 *   theme: economist
 *   output: component
 *   width: 600
 *   height: 400
 * ---
 * ```
 *
 * @example
 * ```ts
 * import { parseMarkdown } from 'comark'
 * import flint from 'comark-flint-chart'
 *
 * const doc = await parseMarkdown(content, { plugins: [flint()] })
 * ```
 *
 * For interactive apps, also register the shipped Vue `<Flint>` renderer:
 * ```ts
 * import flint, { Flint } from 'comark-flint-chart/vue'
 * // <Markdown :plugins="[flint()]" :components="{ Flint }" />
 * ```
 *
 * @see https://github.com/microsoft/flint-chart
 */

import { defineComarkPlugin } from 'comark'
import type { ComarkPluginFactory, ElementNode, Node } from 'comark'
import { visitAsync, textContent } from 'comark/utils'
import { svgToNodes } from './svgToNodes.ts'

export { svgToNodes }

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Chart rendering backend. Mirrors the `flint-chart` assembler set. */
export type FlintBackend = 'vegalite' | 'echarts' | 'chartjs' | 'plotly' | 'excel'

/** Output mode for generated chart nodes. */
export type FlintOutput = 'component' | 'svg' | 'img'

/**
 * Options for the flint plugin factory.
 *
 * All keys in `flint` are merged as global defaults for every directive and
 * fenced block (per-directive/block attrs always take precedence). These are
 * also overridable via the frontmatter `flint` object.
 */
export interface FlintConfig {
  flint?: {
    /**
     * Default rendering backend.
     * @default 'vegalite'
     */
    backend?: FlintBackend
    /**
     * Default Flint theme preset name or custom ThemeSpec object.
     * Pass a string for built-in presets (`'economist'`, `'swiss'`, `'pop'`,
     * `'nyt'`, `'mckinsey'`, …) or an object to extend one.
     */
    theme?: string | Record<string, unknown>
    /** Default chart canvas width in pixels. @default 400 */
    width?: number
    /** Default chart canvas height in pixels. @default 300 */
    height?: number
    /**
     * Default output mode.
     * - `'component'` (default) — produces a `<Flint>` AST component node.
     * - `'svg'` — renders inline `<svg>` at parse time (requires `vega` +
     *   `vega-lite` for the `vegalite` backend, or `echarts` for `echarts`).
     * - `'img'` — renders an `<img src="data:image/svg+xml;base64,…">`.
     * @default 'component'
     */
    output?: FlintOutput
  }
}

/** Keys contributed to `tree.meta` by the flint plugin. */
export interface FlintPluginMeta {
  flint?: {
    /** Number of chart nodes processed in this document. */
    count: number
    /** List of unique backends used in this document. */
    backends: FlintBackend[]
  }
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const VALID_BACKENDS = new Set<string>(['vegalite', 'echarts', 'chartjs', 'plotly', 'excel'])

// ---------------------------------------------------------------------------
// flint-chart peer loader
// ---------------------------------------------------------------------------

type AssembleFn = (input: unknown) => unknown

type FlintModule = {
  assembleVegaLite?: AssembleFn
  assembleECharts?: AssembleFn
  assembleChartjs?: AssembleFn
  assemblePlotly?: AssembleFn
  assembleExcel?: AssembleFn
}

let _flintModule: FlintModule | null = null
let _flintLoadAttempted = false

const loadFlint = async (): Promise<FlintModule | null> => {
  if (_flintLoadAttempted) return _flintModule
  _flintLoadAttempted = true
  try {
    _flintModule = (await import('flint-chart')) as unknown as FlintModule
    return _flintModule
  } catch {
    console.warn(
      '[comark-flint-chart] Peer dependency "flint-chart" is not installed. ' +
        'Run `npm install flint-chart` to enable ::flint directives and fenced blocks.',
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Optional renderer loaders
// ---------------------------------------------------------------------------

/**
 * Render a Vega-Lite spec to an SVG string server-side.
 * Requires `vega` and `vega-lite` optional peers.
 */
const renderVegaLiteToSvg = async (vlSpec: unknown): Promise<string | null> => {
  try {
    const vl = (await import('vega-lite')) as {
      compile: (s: unknown) => { spec: unknown }
    }
    const vega = (await import('vega')) as {
      View: new (runtime: unknown, opts: { renderer: string }) => {
        toSVG: () => Promise<string>
      }
      parse: (spec: unknown) => unknown
    }
    const { spec: vgSpec } = vl.compile(vlSpec)
    const view = new vega.View(vega.parse(vgSpec), { renderer: 'none' })
    return await view.toSVG()
  } catch {
    return null
  }
}

/**
 * Render an ECharts option to an SVG string server-side.
 * Requires the `echarts` optional peer with SSR support.
 */
const renderEChartsToSvg = async (
  option: unknown,
  width: number,
  height: number,
): Promise<string | null> => {
  try {
    const echarts = (await import('echarts')) as {
      init: (
        canvas: null,
        theme: null,
        opts: { renderer: string; ssr: boolean; width: number; height: number },
      ) => {
        setOption: (o: unknown) => void
        renderToSVGString: () => string
        dispose: () => void
      }
    }
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
    chart.setOption(option)
    const svg = chart.renderToSVGString()
    chart.dispose()
    return svg
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Node detection
// ---------------------------------------------------------------------------

/**
 * Detect a fenced `flint` code block in the AST.
 *
 * Handles both MDC-style `pre[language="flint"]` (language attr on `pre`) and
 * remark-style `pre > code.language-flint` (class on child `code` element).
 * Also handles `pre[code="..."]` used by some MDC ProseCode components.
 */
const isFencedFlintBlock = (node: Node): boolean => {
  if (!Array.isArray(node)) return false
  const [tag, attrs] = node as [string, Record<string, unknown>]
  if (tag !== 'pre') return false

  // MDC-style: language attr directly on <pre>
  const lang = attrs?.language ?? attrs?.lang
  if (lang === 'flint') return true

  // remark-style: <pre><code class="language-flint">
  const children = (node as unknown[]).slice(2) as Node[]
  return children.some((child) => {
    if (!Array.isArray(child)) return false
    const [cTag, cAttrs] = child as [string, Record<string, unknown>]
    if (cTag !== 'code') return false
    const cls = String(cAttrs?.class ?? cAttrs?.className ?? '')
    return cls.includes('language-flint')
  })
}

/** Detect a `::flint{...}` directive node. */
const isFlintDirective = (node: Node): boolean =>
  Array.isArray(node) && String((node as ElementNode)[0]) === 'flint'

const isFlintNode = (node: Node): boolean =>
  isFlintDirective(node) || isFencedFlintBlock(node)

// ---------------------------------------------------------------------------
// Spec extraction helpers
// ---------------------------------------------------------------------------

/**
 * Parse Comark fence leftover `meta` into key=value attrs.
 *
 * Comark puts unrecognised info-string tokens into `pre.meta` as a raw string
 * (e.g. `backend="echarts" theme="economist"`). Curly-brace `{…}` in the info
 * string is reserved for line highlights and is not a source of attrs.
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

/**
 * Extract the raw JSON string and metadata attrs from a fenced block node.
 *
 * Merges attrs from both the `<pre>` element and its child `<code>` element.
 * Fence info-string key=value tokens are parsed from Comark's `meta` field.
 */
const extractFencedSpec = (
  el: ElementNode,
): { raw: string; attrs: Record<string, unknown> } => {
  const preAttrs = el[1] as Record<string, unknown>
  const metaAttrs = parseFenceMeta(preAttrs.meta)

  // Some MDC ProseCode components serialise code as a `code` attribute
  if (typeof preAttrs.code === 'string') {
    const { meta: _meta, code: _code, ...rest } = preAttrs
    return { raw: preAttrs.code, attrs: { ...metaAttrs, ...rest } }
  }

  const children = (el as unknown as unknown[]).slice(2) as Node[]
  const raw = children.map((c) => textContent(c)).join('').trim()

  // Merge pre attrs with code child attrs; pre attrs win for precedence
  const codeChild = children.find(
    (c) => Array.isArray(c) && String((c as ElementNode)[0]) === 'code',
  )
  const codeAttrs = codeChild
    ? ((codeChild as ElementNode)[1] as Record<string, unknown>)
    : {}

  const { meta: _meta, ...preRest } = preAttrs
  return { raw, attrs: { ...metaAttrs, ...codeAttrs, ...preRest } }
}

/**
 * Resolve a dotted path such as `"dashboard.kpiChart"` against a data object.
 * Returns `undefined` if any segment is missing.
 */
export const resolvePath = (path: string, data: Record<string, unknown>): unknown =>
  path.split('.').reduce<unknown>((obj, key) => {
    if (obj === null || obj === undefined || typeof obj !== 'object') return undefined
    return (obj as Record<string, unknown>)[key]
  }, data)

// ---------------------------------------------------------------------------
// Spec assembly
// ---------------------------------------------------------------------------

const ASSEMBLER_KEY: Record<FlintBackend, keyof FlintModule> = {
  vegalite: 'assembleVegaLite',
  echarts: 'assembleECharts',
  chartjs: 'assembleChartjs',
  plotly: 'assemblePlotly',
  excel: 'assembleExcel',
}

/**
 * Call the appropriate flint-chart assembler for the requested backend.
 * Throws if the function is not found in the module (version mismatch).
 */
export const assembleSpec = (
  mod: FlintModule,
  input: unknown,
  backend: FlintBackend,
): unknown => {
  const key = ASSEMBLER_KEY[backend]
  const fn = mod[key]
  if (typeof fn !== 'function') {
    throw new Error(
      `flint-chart.${key} is not a function — check your flint-chart version (>=0.5.0 required)`,
    )
  }
  return fn(input)
}

// ---------------------------------------------------------------------------
// Node builders
// ---------------------------------------------------------------------------

/**
 * Produce a `<Flint>` component AST node carrying the compiled spec.
 * Downstream renderers (Vue, React, Svelte) use this node to mount the chart.
 */
const makeFlintNode = (
  compiledSpec: unknown,
  backend: FlintBackend,
  rawInput: unknown,
  extraAttrs: Record<string, unknown>,
): ElementNode =>
  [
    'Flint',
    {
      spec: compiledSpec,
      backend,
      input: rawInput,
      ...extraAttrs,
    },
  ] as unknown as ElementNode

const makeImgNode = (src: string, alt: string): ElementNode =>
  ['img', { src, alt, $: { html: 1, void: 1 } }] as unknown as ElementNode

const makeFallbackNode = (spec: string, err: string): ElementNode => [
  'pre',
  { class: 'flint flint-error' },
  ['code', {}, `[flint error] ${err}\n\n${spec}`],
]

const svgToDataURI = (svg: string): string =>
  `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`

// ---------------------------------------------------------------------------
// Main processing pipeline
// ---------------------------------------------------------------------------

const processFlintNode = async (
  mod: FlintModule,
  el: ElementNode,
  frontmatter: Record<string, unknown>,
  globalConfig: Record<string, unknown>,
): Promise<Node | undefined> => {
  const tag = String(el[0])
  const isDirective = tag === 'flint'
  const nodeAttrs = el[1] as Record<string, unknown>

  let rawSpec: string
  let blockAttrs: Record<string, unknown> = {}
  // Attrs that drive assembly — for fenced blocks these come from parsed meta.
  let attrs: Record<string, unknown> = nodeAttrs

  if (isDirective) {
    // ------------------------------------------------------------------
    // Component directive: ::flint{spec="..." :spec="path" backend="..."}
    // ------------------------------------------------------------------
    let specValue: unknown = undefined

    // `:spec` is a bound expression — try to resolve as dotted path in
    // frontmatter/data. Skip if unresolvable (runtime binding).
    const boundSpec = attrs[':spec']
    if (boundSpec !== undefined) {
      if (typeof boundSpec === 'string') {
        const resolved = resolvePath(boundSpec, frontmatter)
        if (resolved !== undefined) {
          specValue = resolved
        } else {
          // Cannot resolve at parse time — leave node unchanged.
          return undefined
        }
      } else {
        specValue = boundSpec
      }
    }

    if (specValue === undefined) specValue = attrs.spec

    if (specValue === undefined) {
      console.warn(
        '[comark-flint-chart] ::flint directive is missing a spec. ' +
          'Provide spec="..." or :spec="frontmatterPath"',
      )
      return undefined
    }

    rawSpec = typeof specValue === 'string' ? specValue : JSON.stringify(specValue)
  } else {
    // ------------------------------------------------------------------
    // Fenced code block: pre > code.language-flint
    // ------------------------------------------------------------------
    const extracted = extractFencedSpec(el)
    rawSpec = extracted.raw
    attrs = extracted.attrs

    // Pass through unrecognised attrs from the info string as extra attrs
    // but drop language/class markers (backend/theme/width/height are read below).
    const {
      language: _l,
      lang: _n,
      class: _c,
      className: _cn,
      code: _k,
      backend: _b,
      theme: _t,
      width: _w,
      height: _h,
      output: _o,
      ...rest
    } = extracted.attrs
    blockAttrs = rest
  }

  if (!rawSpec) {
    console.warn('[comark-flint-chart] Empty chart spec — skipping')
    return undefined
  }

  const output = String(
    attrs.output ?? globalConfig.output ?? 'component',
  ) as FlintOutput

  const backendRaw = String(attrs.backend ?? globalConfig.backend ?? 'vegalite')
  const backend: FlintBackend = VALID_BACKENDS.has(backendRaw)
    ? (backendRaw as FlintBackend)
    : 'vegalite'

  const theme = attrs.theme ?? globalConfig.theme ?? undefined
  const width = Number(attrs.width ?? globalConfig.width ?? 400)
  const height = Number(attrs.height ?? globalConfig.height ?? 300)

  // Parse the spec JSON (the content of the fenced block or the spec= attr)
  let input: unknown
  try {
    input = typeof rawSpec === 'object' ? rawSpec : JSON.parse(rawSpec)
  } catch {
    console.warn(
      `[comark-flint-chart] Failed to parse spec as JSON: ${rawSpec.slice(0, 120)}…`,
    )
    return makeFallbackNode(rawSpec, 'invalid JSON spec')
  }

  // Inject theme into the input if provided (theme_spec field)
  if (theme !== undefined && input !== null && typeof input === 'object') {
    input = { ...(input as Record<string, unknown>), theme_spec: theme }
  }

  // Compile: flint ChartAssemblyInput → backend-native spec
  let compiledSpec: unknown
  try {
    compiledSpec = assembleSpec(mod, input, backend)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[comark-flint-chart] Spec compilation failed: ${msg}`)
    return makeFallbackNode(rawSpec, msg)
  }

  // ------------------------------------------------------------------
  // SSR rendering path (output="svg" or output="img")
  // ------------------------------------------------------------------
  if (output === 'svg' || output === 'img') {
    let svg: string | null = null

    if (backend === 'vegalite') {
      svg = await renderVegaLiteToSvg(compiledSpec)
    } else if (backend === 'echarts') {
      svg = await renderEChartsToSvg(compiledSpec, width, height)
    }

    if (svg) {
      if (output === 'img') return makeImgNode(svgToDataURI(svg), 'chart')
      const nodes = svgToNodes(svg)
      return nodes.length > 0 ? (nodes[0] as ElementNode) : undefined
    }

    // Renderer not available — warn and fall through to component node
    console.warn(
      `[comark-flint-chart] output="${output}" requested for backend "${backend}" ` +
        `but the renderer peer is not installed. ` +
        (backend === 'vegalite'
          ? 'Install `vega` and `vega-lite` to enable parse-time SVG rendering.'
          : backend === 'echarts'
            ? 'Install `echarts` to enable parse-time SVG rendering.'
            : `Parse-time SVG rendering is not supported for the "${backend}" backend.`),
    )
  }

  // ------------------------------------------------------------------
  // Default: <Flint> component node
  // ------------------------------------------------------------------
  return makeFlintNode(compiledSpec, backend, input, {
    width,
    height,
    ...(theme !== undefined ? { theme } : {}),
    ...blockAttrs,
  })
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the flint-chart plugin for Comark.
 *
 * **Supported entry points:**
 *
 * | Syntax | Example |
 * |---|---|
 * | Fenced block | ` ```flint {backend="vegalite"}\n{...ChartAssemblyInput...}\n``` ` |
 * | Directive | `::flint{:spec="dashboard.kpi" backend="echarts"}` |
 *
 * **Backends:**
 *
 * | Backend | Assembler | SSR rendering |
 * |---|---|---|
 * | `vegalite` (default) | `assembleVegaLite` | vega + vega-lite optional peers |
 * | `echarts` | `assembleECharts` | echarts optional peer |
 * | `chartjs` | `assembleChartjs` | component only |
 * | `plotly` | `assemblePlotly` | component only |
 * | `excel` | `assembleExcel` | component only |
 *
 * **Output modes** via `output=` attr or frontmatter `flint.output`:
 * - `component` (default) — `<Flint>` component node carrying the compiled spec
 * - `svg` — inline `<svg>` (requires renderer peer; falls back to `component`)
 * - `img` — `<img src="data:image/svg+xml;base64,…">`
 *
 * **Binding:** `:spec="path.to.spec"` resolves `path.to.spec` as a dotted
 * lookup against the document frontmatter at parse time. Unresolvable paths
 * (runtime bindings) are left unchanged in the AST.
 */
const plugin: ComarkPluginFactory<FlintConfig> = defineComarkPlugin<FlintConfig>(
  (config = {}) => ({
    name: 'flint',

    async post(state) {
      const mod = await loadFlint()
      if (!mod) return

      const fmFlint =
        (state.tree.frontmatter?.flint as Record<string, unknown> | undefined) ?? {}
      const globalConfig: Record<string, unknown> = { ...config.flint, ...fmFlint }

      const meta: FlintPluginMeta['flint'] = { count: 0, backends: [] }

      await visitAsync(
        state.tree,
        isFlintNode,
        async (node) => {
          const el = node as ElementNode
          const attrs = el[1] as Record<string, unknown>
          const backend = String(
            attrs.backend ?? globalConfig.backend ?? 'vegalite',
          ) as FlintBackend

          try {
            const result = await processFlintNode(
              mod,
              el,
              (state.tree.frontmatter ?? {}) as Record<string, unknown>,
              globalConfig,
            )

            if (result !== undefined) {
              meta!.count++
              if (!meta!.backends.includes(backend)) meta!.backends.push(backend)
            }

            return result
          } catch (err) {
            console.warn(
              `[comark-flint-chart] Unexpected error processing node: ${err instanceof Error ? err.message : String(err)}`,
            )
            return undefined
          }
        },
      )

      if (meta.count > 0) {
        state.tree.meta = { ...state.tree.meta, flint: meta }
      }
    },
  }),
)

export default plugin
