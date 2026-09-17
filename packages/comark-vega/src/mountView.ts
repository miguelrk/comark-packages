import type { ChartEngine } from './index.ts'

export interface MountVegaViewOptions {
  spec: Record<string, unknown>
  engine?: ChartEngine
  width?: number
  height?: number
}

export interface MountedVegaView {
  finalize: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VegaMod = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VegaLiteMod = Record<string, any>

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

const toNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v !== '') {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return undefined
}

/**
 * Mount a Vega / Vega-Lite view into a DOM container.
 * Callers must call `finalize()` on teardown or before remounting.
 */
export const mountVegaView = async (
  el: HTMLElement,
  options: MountVegaViewOptions,
): Promise<MountedVegaView> => {
  const engine = options.engine ?? detectEngine(options.spec)
  const width = toNumber(options.width)
  const height = toNumber(options.height)

  const vega = (await import('vega')) as VegaMod
  let vegaSpec = options.spec

  if (engine === 'vega-lite') {
    const vl = (await import('vega-lite')) as VegaLiteMod
    const specWithDims: Record<string, unknown> = {
      ...options.spec,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
    }
    const result = vl.compile(specWithDims) as { spec: Record<string, unknown> }
    vegaSpec = result.spec
  }

  const runtime = vega.parse(vegaSpec)
  const view: VegaMod = new vega.View(runtime, {
    renderer: 'svg',
    container: el,
    hover: true,
  })
  if (engine === 'vega') {
    if (width != null) view.width(width)
    if (height != null) view.height(height)
  }
  await view.runAsync()

  return {
    finalize: () => {
      try {
        view.finalize()
      } catch {
        /* ignore teardown errors */
      }
    },
  }
}
