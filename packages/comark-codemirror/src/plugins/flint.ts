/**
 * comark-flint-chart: charts from a spec (`::flint` or a ```` ```flint ```` fence).
 */
import type { ComponentDef } from '../types.ts'
import { definePlugin } from '../plugins.ts'

export const flintComponents: ComponentDef[] = [{
  name: 'flint',
  kind: 'block',
  group: 'Charts',
  description: 'Chart (Vega-Lite, ECharts, Chart.js, Plotly, Excel)',
  props: {
    spec: { type: 'object', description: 'Chart spec (usually `:spec` bound to data)' },
    backend: { enum: ['vegalite', 'echarts', 'chartjs', 'plotly', 'excel'] },
    theme: { type: 'string' },
    output: { enum: ['component', 'svg', 'img'] },
    width: { type: 'string' },
    height: { type: 'string' },
  },
  example: '::flint{:spec="data.chart" backend="vegalite"}\n::',
}]

export default definePlugin(() => ({
  name: 'flint',
  components: flintComponents,
  fences: ['flint'],
  snippets: [{ label: 'Flint chart', insert: '```flint\n{\n  $0\n}\n```', detail: '```flint', section: 'Charts', type: 'fence' }],
  llms: 'Charts (comark-flint-chart): `::flint{:spec="data.chart" backend="vegalite"}` or a ```` ```flint ```` fence with a JSON spec.',
}))
