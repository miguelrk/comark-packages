import type { ElementNode, MarkdownDocument } from 'comark'
import { parseMarkdown } from 'comark'
import { render } from 'comark/render'
import { describe, expect, it, vi } from 'vitest'
import vega, { coerceValue } from '../src/index.ts'
import type { VegaNodeAttrs } from '../src/index.ts'

const renderHtml = async (tree: MarkdownDocument) =>
  (await render(tree, { blockSeparator: '\n', format: 'text/html' })).trim()

// ---------------------------------------------------------------------------
// Helpers — wrap spec in a code fence so Comark does not mangle the JSON.
// Comark treats `{...}` in directive block bodies as directive attribute
// syntax. Code-fenced content is preserved verbatim as a pre/code child.
// ---------------------------------------------------------------------------

const fence = (json: string) => `\`\`\`\n${json}\n\`\`\``

// ---------------------------------------------------------------------------
// Minimal specs reused across tests
// ---------------------------------------------------------------------------

const barSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  mark: 'bar',
  data: { values: [{ x: 'A', y: 4 }, { x: 'B', y: 6 }, { x: 'C', y: 2 }] },
  encoding: {
    x: { field: 'x', type: 'nominal' },
    y: { field: 'y', type: 'quantitative' },
  },
}
const barSpecJson = JSON.stringify(barSpec)

const lineSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  mark: 'line',
  data: { values: [{ x: 1, y: 1 }, { x: 2, y: 4 }, { x: 3, y: 2 }] },
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  },
}
const lineSpecJson = JSON.stringify(lineSpec)

const vegaBarSpec = {
  $schema: 'https://vega.github.io/schema/vega/v6.json',
  width: 200,
  height: 100,
  data: [{ name: 'table', values: [{ x: 'A', y: 4 }, { x: 'B', y: 6 }] }],
  scales: [
    { name: 'xscale', type: 'band', domain: { data: 'table', field: 'x' }, range: 'width' },
    { name: 'yscale', domain: { data: 'table', field: 'y' }, range: 'height' },
  ],
  marks: [{
    type: 'rect',
    from: { data: 'table' },
    encode: {
      enter: {
        x: { scale: 'xscale', field: 'x' },
        width: { scale: 'xscale', band: 1 },
        y: { scale: 'yscale', field: 'y' },
        y2: { scale: 'yscale', value: 0 },
      },
    },
  }],
}
const vegaBarSpecJson = JSON.stringify(vegaBarSpec)

// ---------------------------------------------------------------------------
// ::vl directive (Vega-Lite)
// ---------------------------------------------------------------------------

describe('vega plugin — ::vl directive', () => {
  it('generates inline SVG for a Vega-Lite bar chart', async () => {
    const md = `::vl\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
    expect(html).toContain('</svg>')
  })

  it('replaces ::vl node with an svg ElementNode in the AST', async () => {
    const md = `::vl\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const svgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'svg')
    expect(svgNode).toBeDefined()
  })

  it('generates inline SVG for a Vega-Lite line chart', async () => {
    const md = `::vl\n${fence(lineSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })

  it('::vega-lite alias works identically to ::vl', async () => {
    const md = `::vega-lite\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })
})

// ---------------------------------------------------------------------------
// ::vg directive (full Vega)
// ---------------------------------------------------------------------------

describe('vega plugin — ::vg directive', () => {
  it('generates inline SVG for a full Vega spec', async () => {
    const md = `::vg\n${fence(vegaBarSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })

  it('replaces ::vg node with an svg ElementNode in the AST', async () => {
    const md = `::vg\n${fence(vegaBarSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const svgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'svg')
    expect(svgNode).toBeDefined()
  })

  it('::vg renders inline SVG (::vega alias was removed — use ::vega for component syntax)', async () => {
    const md = `::vg\n${fence(vegaBarSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const svgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'svg')
    expect(svgNode).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ::chart directive (auto-detection)
// ---------------------------------------------------------------------------

describe('vega plugin — ::chart auto-detection', () => {
  it('auto-detects vega-lite from $schema and renders SVG', async () => {
    const md = `::chart\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })

  it('auto-detects vega from $schema and renders SVG', async () => {
    const md = `::chart\n${fence(vegaBarSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })

  it('engine= attr overrides auto-detection', async () => {
    const md = `::chart{engine="vega-lite"}\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })
})

// ---------------------------------------------------------------------------
// Mark-shortcut directives
// ---------------------------------------------------------------------------

describe('vega plugin — mark-shortcut directives', () => {
  it('::chart-bar injects mark:bar into spec body', async () => {
    const specWithoutMark = JSON.stringify({
      data: { values: [{ x: 'A', y: 4 }, { x: 'B', y: 6 }] },
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'quantitative' },
      },
    })
    const md = `::chart-bar\n${fence(specWithoutMark)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })

  it('::chart-line renders a line chart', async () => {
    const md = `::chart-line\n${fence(lineSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })

  it('::chart-arc renders an arc (pie/donut) chart', async () => {
    const arcSpec = JSON.stringify({
      data: { values: [{ label: 'A', n: 4 }, { label: 'B', n: 6 }] },
      encoding: {
        theta: { field: 'n', type: 'quantitative' },
        color: { field: 'label', type: 'nominal' },
      },
    })
    const md = `::chart-arc\n${fence(arcSpec)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })
})

// ---------------------------------------------------------------------------
// Output modes
// ---------------------------------------------------------------------------

describe('vega plugin — output modes', () => {
  it('output="svg" produces an inline svg element (default)', async () => {
    const md = `::vl{output="svg"}\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const svgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'svg')
    expect(svgNode).toBeDefined()
  })

  it('output="img" produces an img node with SVG data URI', async () => {
    const md = `::vl{output="img"}\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const imgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'img') as ElementNode | undefined
    expect(imgNode).toBeDefined()
    expect(String((imgNode![1] as Record<string, unknown>)['src'])).toMatch(/^data:image\/svg\+xml/)
  })
})

// ---------------------------------------------------------------------------
// Width / height attrs
// ---------------------------------------------------------------------------

describe('vega plugin — width / height attrs', () => {
  it('width= and height= attrs are passed to the view', async () => {
    const md = `::vl{width="300" height="200"}\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('<svg')
  })
})

// ---------------------------------------------------------------------------
// Frontmatter defaults
// ---------------------------------------------------------------------------

describe('vega plugin — frontmatter defaults', () => {
  it('applies frontmatter vega.output to all directives', async () => {
    const md = `---
vega:
  output: img
---

::vl
${fence(barSpecJson)}
::
`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const imgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'img')
    expect(imgNode).toBeDefined()
  })

  it('per-directive output= attr overrides frontmatter default', async () => {
    const md = `---
vega:
  output: img
---

::vl{output="svg"}
${fence(barSpecJson)}
::
`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const svgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'svg')
    expect(svgNode).toBeDefined()
  })

  it('plugin config defaults are applied', async () => {
    const md = `::vl\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, {
      plugins: [vega({ vega: { output: 'img' } })],
    })
    const imgNode = nodes.find((n) => Array.isArray(n) && n[0] === 'img')
    expect(imgNode).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// coerceValue utility
// ---------------------------------------------------------------------------

describe('coerceValue()', () => {
  it('coerces "true"/"false" strings to booleans', () => {
    expect(coerceValue('true')).toBe(true)
    expect(coerceValue('false')).toBe(false)
  })

  it('coerces numeric strings to numbers', () => {
    expect(coerceValue('400')).toBe(400)
    expect(coerceValue('1.5')).toBe(1.5)
  })

  it('parses JSON objects and arrays', () => {
    expect(coerceValue('{"foo":"bar"}')).toEqual({ foo: 'bar' })
    expect(coerceValue('["a","b"]')).toEqual(['a', 'b'])
  })

  it('keeps plain strings as-is', () => {
    expect(coerceValue('vega-lite')).toBe('vega-lite')
  })

  it('passes non-string values through unchanged', () => {
    expect(coerceValue(42)).toBe(42)
    expect(coerceValue(true)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Error tolerance
// ---------------------------------------------------------------------------

describe('vega plugin — error tolerance', () => {
  it('emits a fallback node on an invalid spec and does not throw', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // mark:bar with no encoding — vega-lite will error during compilation
    const invalidSpec = JSON.stringify({ mark: 'bar' })
    const md = `::vl\n${fence(invalidSpec)}\n::`
    await expect(parseMarkdown(md, { plugins: [vega()] })).resolves.toBeDefined()
    warnSpy.mockRestore()
  })

  it('warns and skips a directive with no spec', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { nodes } = await parseMarkdown('::chart{output="svg"}::', { plugins: [vega()] })
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(typeof html).toBe('string')
    warnSpy.mockRestore()
  })

  it('leaves directives unchanged when plugin is not used', async () => {
    const md = `::vl\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md)
    expect(nodes.some((n) => Array.isArray(n) && n[0] === 'vl')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Multiple directives in one document
// ---------------------------------------------------------------------------

describe('vega plugin — multiple directives', () => {
  it('processes multiple directives in one document', async () => {
    const md = `
::vl
${fence(barSpecJson)}
::

::chart-line
${fence(lineSpecJson)}
::
`.trim()
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    expect(nodes.some((n) => Array.isArray(n) && n[0] === 'vl')).toBe(false)
    expect(nodes.some((n) => Array.isArray(n) && n[0] === 'chart-line')).toBe(false)
    const svgCount = nodes.filter((n) => Array.isArray(n) && n[0] === 'svg').length
    expect(svgCount).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// Fenced `vega` / `vega-lite` code block → <Vega> component node
//
// Code-fence content is opaque to Comark's parser — `{…}` is never
// interpreted as directive attribute syntax, so raw JSON is safe.
// ---------------------------------------------------------------------------

const vegaComponentNode = (nodes: unknown[]) =>
  nodes.find((n) => Array.isArray(n) && (n as unknown[])[0] === 'Vega') as [
    'Vega',
    VegaNodeAttrs,
    ...unknown[],
  ] | undefined

describe('vega plugin — fenced code block entry point', () => {
  it('fenced `vega` block produces a <Vega> component node', async () => {
    const md = `\`\`\`vega\n${vegaBarSpecJson}\n\`\`\``
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const node = vegaComponentNode(nodes)
    expect(node).toBeDefined()
    expect(node![1].engine).toBe('vega')
    expect(node![1].spec).toMatchObject({ $schema: expect.stringContaining('vega/') })
  })

  it('fenced `vega-lite` block produces a <Vega> component node with engine vega-lite', async () => {
    const md = `\`\`\`vega-lite\n${barSpecJson}\n\`\`\``
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const node = vegaComponentNode(nodes)
    expect(node).toBeDefined()
    expect(node![1].engine).toBe('vega-lite')
    expect(node![1].spec).toMatchObject({ mark: 'bar' })
  })

  it('fenced block auto-detects engine from $schema regardless of language tag', async () => {
    // Language tag says `vega` but $schema says vega-lite — schema wins.
    const md = `\`\`\`vega\n${barSpecJson}\n\`\`\``
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const node = vegaComponentNode(nodes)
    expect(node![1].engine).toBe('vega-lite')
  })

  it('fenced block does not produce an inline SVG node', async () => {
    const md = `\`\`\`vega-lite\n${barSpecJson}\n\`\`\``
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    expect(nodes.some((n) => Array.isArray(n) && n[0] === 'svg')).toBe(false)
  })

  it('fenced block spec is the same object shape as the directive entry point', async () => {
    const fencedMd = `\`\`\`vega-lite\n${barSpecJson}\n\`\`\``
    const directiveMd = `::vega\n${fence(barSpecJson)}\n::`

    const { nodes: fencedNodes } = await parseMarkdown(fencedMd, { plugins: [vega()] })
    const { nodes: directiveNodes } = await parseMarkdown(directiveMd, { plugins: [vega()] })

    const fencedNode = vegaComponentNode(fencedNodes)
    const directiveNode = vegaComponentNode(directiveNodes)

    expect(fencedNode![0]).toBe('Vega')
    expect(directiveNode![0]).toBe('Vega')
    // Both carry the same spec object.
    expect(fencedNode![1].spec).toEqual(directiveNode![1].spec)
  })
})

// ---------------------------------------------------------------------------
// `::vega` component directive → <Vega> component node
//
// `::vega` is no longer an inline-SVG alias for the Vega engine.
// It is a component directive that preserves `:prop="expr"` bindings for
// `@comark/binding` to resolve at render time.
// ---------------------------------------------------------------------------

describe('vega plugin — ::vega component directive entry point', () => {
  it('::vega with :spec binding produces a <Vega> node with the binding preserved', async () => {
    const { nodes } = await parseMarkdown('::vega{:spec="report.chart"}', { plugins: [vega()] })
    const node = vegaComponentNode(nodes)
    expect(node).toBeDefined()
    expect(node![1][':spec']).toBe('report.chart')
    // No spec literal — it will be resolved at render time.
    expect(node![1].spec).toBeUndefined()
  })

  it('plain (non-:) attrs on ::vega are coerced to their JS types', async () => {
    const { nodes } = await parseMarkdown(
      '::vega{engine="vega-lite" width="400" height="300"}',
      { plugins: [vega()] },
    )
    const node = vegaComponentNode(nodes)
    expect(node![1].engine).toBe('vega-lite')
    expect(node![1].width).toBe(400)
    expect(node![1].height).toBe(300)
  })

  it('::vega with a code-fenced body carries the literal spec as a prop', async () => {
    const md = `::vega{engine="vega-lite"}\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const node = vegaComponentNode(nodes)
    expect(node).toBeDefined()
    expect(node![1].spec).toMatchObject({ mark: 'bar' })
    // :spec binding must not be present when spec is resolved from body.
    expect(node![1][':spec']).toBeUndefined()
  })

  it(':spec binding takes priority over a code-fenced body', async () => {
    const md = `::vega{:spec="dashboard.revenue"}\n${fence(barSpecJson)}\n::`
    const { nodes } = await parseMarkdown(md, { plugins: [vega()] })
    const node = vegaComponentNode(nodes)
    // Body spec is ignored when a binding is present.
    expect(node![1][':spec']).toBe('dashboard.revenue')
    expect(node![1].spec).toBeUndefined()
  })

  it('multiple :prop bindings are all preserved verbatim', async () => {
    const { nodes } = await parseMarkdown(
      '::vega{:spec="report.chart" :width="panel.w" engine="vega-lite"}',
      { plugins: [vega()] },
    )
    const node = vegaComponentNode(nodes)
    expect(node![1][':spec']).toBe('report.chart')
    expect(node![1][':width']).toBe('panel.w')
    expect(node![1].engine).toBe('vega-lite')
  })

  it('::vega does not produce an inline SVG node', async () => {
    const { nodes } = await parseMarkdown(
      '::vega{:spec="report.chart"}',
      { plugins: [vega()] },
    )
    expect(nodes.some((n) => Array.isArray(n) && n[0] === 'svg')).toBe(false)
  })
})
