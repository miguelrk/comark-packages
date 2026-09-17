<script setup lang="ts">
import vega, { Vega } from 'comark-vega/vue'

useHead({ title: 'Playground' })

const barSpec = JSON.stringify({
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
  },
  width: 500,
  height: 220,
})

const lineSpec = JSON.stringify({
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
  width: 500,
  height: 220,
})

const arcSpec = JSON.stringify({
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
  width: 280,
  height: 280,
})

const scatterSpec = JSON.stringify({
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  mark: 'point',
  data: {
    values: Array.from({ length: 30 }, (_, i) => ({
      x: Math.round(10 + i * 3 + Math.random() * 15),
      y: Math.round(5 + i * 2 + Math.random() * 20),
      category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
    })),
  },
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  width: 340,
  height: 240,
})

const vegaSpec = JSON.stringify({
  $schema: 'https://vega.github.io/schema/vega/v6.json',
  width: 340,
  height: 200,
  data: [
    {
      name: 'table',
      values: [
        { x: 'Q1', y: 28 },
        { x: 'Q2', y: 55 },
        { x: 'Q3', y: 43 },
        { x: 'Q4', y: 91 },
      ],
    },
  ],
  scales: [
    { name: 'xscale', type: 'band', domain: { data: 'table', field: 'x' }, range: 'width', padding: 0.2 },
    { name: 'yscale', domain: { data: 'table', field: 'y' }, range: 'height', nice: true },
  ],
  axes: [
    { orient: 'bottom', scale: 'xscale' },
    { orient: 'left', scale: 'yscale' },
  ],
  marks: [
    {
      type: 'rect',
      from: { data: 'table' },
      encode: {
        enter: {
          x: { scale: 'xscale', field: 'x' },
          width: { scale: 'xscale', band: 1 },
          y: { scale: 'yscale', field: 'y' },
          y2: { scale: 'yscale', value: 0 },
          fill: { value: 'steelblue' },
        },
        hover: { fill: { value: 'firebrick' } },
      },
    },
  ],
})

// Specs must be wrapped in code fences inside the directive block body.
// Comark treats bare `{...}` in block bodies as directive attribute syntax.
// Code-fenced content is preserved verbatim as pre/code AST nodes.
const fence = (json: string) => `\`\`\`\n${json}\n\`\`\``

const markdown = `
# comark-vega — Chart Plugin

## Component path (recommended)

Fenced \`\`\`vega-lite\`\`\` / \`\`\`vega\`\`\` blocks and \`::vega\` emit a \`<Vega>\` AST node.
Pass the shipped Vue renderer.

\`\`\`vega-lite
${barSpec}
\`\`\`

\`\`\`vega
${vegaSpec}
\`\`\`

::vega{engine="vega-lite" width="500" height="220"}
${fence(lineSpec)}
::

## Parse-time SVG (static / no runtime)

\`::vl\`, \`::vg\`, \`::chart\`, and mark shortcuts still render inline SVG at parse time.

## Order Status (Vega-Lite shortcut · Donut)

::chart-arc
${fence(arcSpec)}
::

## Scatter Plot (auto-detected · Point)

::chart
${fence(scatterSpec)}
::

## SVG img output mode

::vl{output="img"}
${fence(barSpec)}
::
`

const plugins = [vega()]
const components = { Vega }
</script>

<template>
  <main class="docs">
    <article class="prose">
      <ClientOnly>
        <Suspense>
          <Markdown
            :plugins="plugins"
            :components="components"
          >
            {{ markdown }}
          </Markdown>
          <template #fallback>
            <p class="muted">Loading charts…</p>
          </template>
        </Suspense>
        <template #fallback>
          <p class="muted">Loading charts…</p>
        </template>
      </ClientOnly>
    </article>
  </main>
</template>
