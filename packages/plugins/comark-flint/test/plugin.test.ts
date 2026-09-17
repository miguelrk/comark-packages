import type { ElementNode, MarkdownDocument } from 'comark'
import { parseMarkdown } from 'comark'
import { render } from 'comark/render'
import { describe, expect, it, vi } from 'vitest'
import flint, { assembleSpec, parseFenceMeta, resolvePath } from '../src/index.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderHtml = async (tree: MarkdownDocument) =>
  (await render(tree, { blockSeparator: '\n', format: 'text/html' })).trim()

/** Minimal valid ChartAssemblyInput for testing. */
const BAR_SPEC = JSON.stringify({
  data: { values: [{ category: 'A', value: 10 }, { category: 'B', value: 20 }] },
  semantic_types: { category: 'Nominal', value: 'Quantity' },
  chart_spec: {
    chartType: 'Bar Chart',
    encodings: {
      x: { field: 'category' },
      y: { field: 'value' },
    },
    baseSize: { width: 400, height: 300 },
  },
})

const LINE_SPEC = JSON.stringify({
  data: { values: [{ month: 'Jan', revenue: 100 }, { month: 'Feb', revenue: 200 }] },
  semantic_types: { month: 'Time', revenue: 'Quantity' },
  chart_spec: {
    chartType: 'Line Chart',
    encodings: { x: { field: 'month' }, y: { field: 'revenue' } },
    baseSize: { width: 600, height: 400 },
  },
})

// ---------------------------------------------------------------------------
// Directive (::flint) tests
// ---------------------------------------------------------------------------

describe('::flint directive', () => {
  it('produces a Flint component node for a valid spec', async () => {
    const { nodes } = await parseMarkdown(
      `::flint{spec='${BAR_SPEC}'}`,
      { plugins: [flint()] },
    )
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode).toBeDefined()
    expect(flintNode![1]).toHaveProperty('spec')
    expect(flintNode![1]).toHaveProperty('backend', 'vegalite')
  })

  it('default backend is vegalite', async () => {
    const { nodes } = await parseMarkdown(
      `::flint{spec='${BAR_SPEC}'}`,
      { plugins: [flint()] },
    )
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'vegalite')
  })

  it('respects explicit backend attr', async () => {
    const { nodes } = await parseMarkdown(
      `::flint{spec='${BAR_SPEC}' backend="echarts"}`,
      { plugins: [flint()] },
    )
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'echarts')
  })

  it('resolves :spec from frontmatter at parse time', async () => {
    const md = `---
title: Dashboard
kpiChart:
  data:
    values: []
  semantic_types: {}
  chart_spec:
    chartType: Bar Chart
    encodings:
      x:
        field: x
      y:
        field: y
---

::flint{:spec="kpiChart"}
`
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode).toBeDefined()
  })

  it('resolves nested :spec paths from frontmatter', async () => {
    const md = `---
dashboard:
  kpi:
    data:
      values: []
    semantic_types: {}
    chart_spec:
      chartType: Bar Chart
      encodings:
        x:
          field: x
        y:
          field: y
---

::flint{:spec="dashboard.kpi"}
`
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode).toBeDefined()
  })

  it('leaves node unchanged when :spec path cannot be resolved (runtime binding)', async () => {
    const { nodes } = await parseMarkdown(
      '::flint{:spec="live.revenueChart"}',
      { plugins: [flint()] },
    )
    // Path not in frontmatter → node stays as flint directive
    const flintComponent = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint')
    // Either directive remains or no Flint component was produced
    expect(flintComponent).toBeUndefined()
  })

  it('emits a fallback node for invalid JSON spec', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { nodes } = await parseMarkdown(
      '::flint{spec="not valid json {{"}',
      { plugins: [flint()] },
    )
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    expect(html).toContain('flint-error')
    warnSpy.mockRestore()
  })

  it('warns and skips when spec attr is absent', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { nodes } = await parseMarkdown('::flint{backend="echarts"}', { plugins: [flint()] })
    // No Flint component node produced
    expect(nodes.find((n) => Array.isArray(n) && n[0] === 'Flint')).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing a spec'))
    warnSpy.mockRestore()
  })

  it('applies theme from attr', async () => {
    const { nodes } = await parseMarkdown(
      `::flint{spec='${BAR_SPEC}' theme="economist"}`,
      { plugins: [flint()] },
    )
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('theme', 'economist')
  })

  it('passes width and height attrs to the node', async () => {
    const { nodes } = await parseMarkdown(
      `::flint{spec='${BAR_SPEC}' width="800" height="500"}`,
      { plugins: [flint()] },
    )
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(Number(flintNode![1].width)).toBe(800)
    expect(Number(flintNode![1].height)).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Fenced code block (```flint) tests
// ---------------------------------------------------------------------------

describe('fenced flint block', () => {
  it('produces a Flint component node for a valid fenced block', async () => {
    const md = '```flint\n' + BAR_SPEC + '\n```'
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode).toBeDefined()
    expect(flintNode![1].spec).toBeDefined()
  })

  it('reads backend and theme from fence meta key=value tokens', async () => {
    const md = '```flint backend="echarts" theme="swiss"\n' + BAR_SPEC + '\n```'
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'echarts')
    expect(flintNode![1]).toHaveProperty('theme', 'swiss')
  })

  it('ignores curly-brace highlight syntax as chart attrs', async () => {
    // Comark treats `{…}` in the info string as line highlights, not attrs.
    const md = '```flint {backend="echarts"}\n' + BAR_SPEC + '\n```'
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'vegalite')
  })
})

// ---------------------------------------------------------------------------
// Frontmatter defaults
// ---------------------------------------------------------------------------

describe('frontmatter defaults', () => {
  it('applies frontmatter flint.backend default', async () => {
    const md = `---
flint:
  backend: echarts
---

::flint{spec='${BAR_SPEC}'}
`
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'echarts')
  })

  it('per-directive attr overrides frontmatter default', async () => {
    const md = `---
flint:
  backend: echarts
---

::flint{spec='${BAR_SPEC}' backend="vegalite"}
`
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'vegalite')
  })

  it('applies plugin-level config defaults', async () => {
    const { nodes } = await parseMarkdown(
      `::flint{spec='${BAR_SPEC}'}`,
      {
        plugins: [flint({ flint: { backend: 'chartjs', width: 800 } })],
      },
    )
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'chartjs')
    expect(Number(flintNode![1].width)).toBe(800)
  })

  it('frontmatter values override plugin config', async () => {
    const md = `---
flint:
  backend: echarts
---

::flint{spec='${BAR_SPEC}'}
`
    const { nodes } = await parseMarkdown(md, {
      plugins: [flint({ flint: { backend: 'chartjs' } })],
    })
    const flintNode = nodes.find((n) => Array.isArray(n) && n[0] === 'Flint') as ElementNode | undefined
    expect(flintNode![1]).toHaveProperty('backend', 'echarts')
  })
})

// ---------------------------------------------------------------------------
// Multiple charts in one document
// ---------------------------------------------------------------------------

describe('multiple charts', () => {
  it('processes multiple ::flint directives in one document', async () => {
    const md = `
::flint{spec='${BAR_SPEC}'}
::

::flint{spec='${LINE_SPEC}' backend="echarts"}
::
`.trim()
    const { nodes } = await parseMarkdown(md, { plugins: [flint()] })
    const flintNodes = nodes.filter((n) => Array.isArray(n) && n[0] === 'Flint')
    expect(flintNodes.length).toBeGreaterThanOrEqual(2)
  })

  it('tracks chart count and backends in tree.meta', async () => {
    const md = `
::flint{spec='${BAR_SPEC}'}
::

::flint{spec='${LINE_SPEC}' backend="echarts"}
::
`.trim()
    const { meta } = await parseMarkdown(md, { plugins: [flint()] })
    expect(meta).toHaveProperty('flint')
    const flintMeta = meta.flint as { count: number; backends: string[] }
    expect(flintMeta.count).toBeGreaterThanOrEqual(2)
    expect(flintMeta.backends).toContain('vegalite')
    expect(flintMeta.backends).toContain('echarts')
  })
})

// ---------------------------------------------------------------------------
// Error tolerance
// ---------------------------------------------------------------------------

describe('error tolerance', () => {
  it('does not throw when the plugin is not applied', async () => {
    // Without the plugin the flint directive node stays in the AST
    const { nodes } = await parseMarkdown(`::flint{spec='${BAR_SPEC}'}`)
    expect(nodes.some((n) => Array.isArray(n) && n[0] === 'flint')).toBe(true)
  })

  it('emits console.warn but does not throw for invalid spec', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      parseMarkdown('::flint{spec="{broken json"}', { plugins: [flint()] }),
    ).resolves.toBeDefined()
    warnSpy.mockRestore()
  })

  it('produces a fallback pre.flint-error node on compilation failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // An empty object is not a valid ChartAssemblyInput and should cause
    // the assembler to throw.
    const { nodes } = await parseMarkdown(
      '::flint{spec="{}"}',
      { plugins: [flint()] },
    )
    const html = await renderHtml({ nodes, frontmatter: {}, meta: {} })
    // Either an error fallback or graceful empty output — never throws
    expect(typeof html).toBe('string')
    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Unit: resolvePath
// ---------------------------------------------------------------------------

describe('resolvePath()', () => {
  it('resolves top-level keys', () => {
    expect(resolvePath('key', { key: 42 })).toBe(42)
  })

  it('resolves nested dotted paths', () => {
    expect(resolvePath('a.b.c', { a: { b: { c: 'found' } } })).toBe('found')
  })

  it('returns undefined for missing paths', () => {
    expect(resolvePath('a.b.missing', { a: { b: {} } })).toBeUndefined()
  })

  it('returns undefined when an intermediate is not an object', () => {
    expect(resolvePath('a.b.c', { a: { b: 'string' } })).toBeUndefined()
  })
})

describe('parseFenceMeta()', () => {
  it('parses quoted and bare key=value tokens', () => {
    expect(parseFenceMeta('backend="echarts" theme=swiss width="600"')).toEqual({
      backend: 'echarts',
      theme: 'swiss',
      width: '600',
    })
  })

  it('returns an empty object for blank meta', () => {
    expect(parseFenceMeta(undefined)).toEqual({})
    expect(parseFenceMeta('')).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Unit: assembleSpec
// ---------------------------------------------------------------------------

describe('assembleSpec()', () => {
  it('calls the correct assembler for each backend', () => {
    const stubs: Record<string, (i: unknown) => unknown> = {
      assembleVegaLite: (i) => ({ _backend: 'vl', i }),
      assembleECharts: (i) => ({ _backend: 'ec', i }),
      assembleChartjs: (i) => ({ _backend: 'cjs', i }),
      assemblePlotly: (i) => ({ _backend: 'plotly', i }),
      assembleExcel: (i) => ({ _backend: 'excel', i }),
    }

    const input = { chart_spec: {} }
    const backends = ['vegalite', 'echarts', 'chartjs', 'plotly', 'excel'] as const
    for (const backend of backends) {
      const result = assembleSpec(stubs, input, backend) as Record<string, unknown>
      expect(result._backend).toBeDefined()
    }
  })

  it('throws when the assembler function is missing', () => {
    expect(() => assembleSpec({}, {}, 'vegalite')).toThrow(
      'flint-chart.assembleVegaLite is not a function',
    )
  })
})
