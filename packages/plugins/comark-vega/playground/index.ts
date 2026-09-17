import { parseMarkdown } from 'comark'
import vega from '../src/index.ts'

const barSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  mark: 'bar',
  data: {
    values: [
      { product: 'Valves', sales: 42000 },
      { product: 'Pipes', sales: 31500 },
      { product: 'Fittings', sales: 27800 },
      { product: 'Flanges', sales: 19200 },
      { product: 'Gaskets', sales: 14600 },
    ],
  },
  encoding: {
    x: { field: 'sales', type: 'quantitative', title: 'Sales (MXN)' },
    y: { field: 'product', type: 'nominal', sort: '-x', title: 'Product' },
    color: { field: 'sales', type: 'quantitative', scale: { scheme: 'tealblues' } },
    tooltip: [
      { field: 'product', type: 'nominal' },
      { field: 'sales', type: 'quantitative', format: ',.0f' },
    ],
  },
  width: 400,
  height: 200,
}

const lineSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  mark: { type: 'line', point: true },
  data: {
    values: [
      { month: 'Jan', inventory: 1200 },
      { month: 'Feb', inventory: 980 },
      { month: 'Mar', inventory: 1350 },
      { month: 'Apr', inventory: 1100 },
      { month: 'May', inventory: 1480 },
      { month: 'Jun', inventory: 1650 },
    ],
  },
  encoding: {
    x: { field: 'month', type: 'nominal', sort: null, title: 'Month' },
    y: { field: 'inventory', type: 'quantitative', title: 'Inventory (units)' },
  },
  width: 400,
  height: 200,
}

const arcSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  mark: { type: 'arc', innerRadius: 60 },
  data: {
    values: [
      { category: 'On time', count: 74 },
      { category: 'Delayed', count: 18 },
      { category: 'Cancelled', count: 8 },
    ],
  },
  encoding: {
    theta: { field: 'count', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  width: 260,
  height: 260,
}

const layerSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  layer: [
    {
      mark: 'bar',
      encoding: {
        x: { field: 'month', type: 'nominal', sort: null },
        y: { field: 'revenue', type: 'quantitative', title: 'Revenue (k)' },
      },
    },
    {
      mark: { type: 'line', color: 'firebrick', point: true },
      encoding: {
        x: { field: 'month', type: 'nominal' },
        y: { field: 'target', type: 'quantitative' },
      },
    },
  ],
  data: {
    values: [
      { month: 'Jan', revenue: 82, target: 90 },
      { month: 'Feb', revenue: 91, target: 90 },
      { month: 'Mar', revenue: 88, target: 95 },
      { month: 'Apr', revenue: 103, target: 95 },
      { month: 'May', revenue: 112, target: 100 },
      { month: 'Jun', revenue: 98, target: 100 },
    ],
  },
  width: 400,
  height: 220,
}

// Specs must be wrapped in code fences inside the directive block body.
// Comark treats bare `{...}` in block bodies as directive attribute syntax.
// Code-fenced content is preserved verbatim as pre/code AST nodes.
const fence = (json: string) => `\`\`\`\n${json}\n\`\`\``

const content = `---
title: Vega playground
vega:
  output: svg
---

# comark-vega

Charts rendered at parse time — no runtime component required.

## Sales by Product (Horizontal Bar)

::vl
${fence(JSON.stringify(barSpec, null, 2))}
::

## Inventory Trend (Line + Points)

::chart-line
${fence(JSON.stringify(lineSpec, null, 2))}
::

## Order Status (Donut)

::chart-arc
${fence(JSON.stringify(arcSpec, null, 2))}
::

## Revenue vs Target (Layered)

::chart
${fence(JSON.stringify(layerSpec, null, 2))}
::
`

const tree = await parseMarkdown(content, { plugins: [vega()] })

console.log('frontmatter:', tree.frontmatter)
console.log(
  'nodes:',
  tree.nodes.map((n) => (Array.isArray(n) ? [n[0], Object.keys((n[1] as Record<string, unknown>) ?? {})] : typeof n)),
)
