/**
 * comark-vega: Vega and Vega-Lite charts as components (`::chart-bar{…}`).
 */
import type { ComponentDef, PropDef } from '../types.ts'
import { definePlugin } from '../plugins.ts'

const props: Record<string, PropDef> = {
  spec: { type: 'object', description: 'Chart spec (usually `:spec` bound to data)' },
  engine: { enum: ['vega', 'vega-lite'] },
  width: { type: 'string' },
  height: { type: 'string' },
}

export const VEGA_TAGS = [
  'vega', 'chart', 'vl', 'vega-lite', 'vg', 'chart-arc', 'chart-area', 'chart-bar', 'chart-boxplot', 'chart-circle',
  'chart-errorband', 'chart-errorbar', 'chart-geoshape', 'chart-image', 'chart-line', 'chart-point', 'chart-rect',
  'chart-rule', 'chart-square', 'chart-text', 'chart-tick', 'chart-trail',
] as const

export const vegaComponents: ComponentDef[] = VEGA_TAGS.map(name => ({ name, kind: 'block', group: 'Charts', description: 'Vega chart', props }))

export default definePlugin(() => ({
  name: 'vega',
  components: vegaComponents,
  llms: 'Vega charts (comark-vega): `::chart-bar{:spec="data.sales"}` (or `::vega` / `::vega-lite` with a spec).',
}))
