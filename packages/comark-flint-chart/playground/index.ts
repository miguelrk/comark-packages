import { parseMarkdown } from 'comark'
import flint from '../src/index.ts'

const content = `---
title: Flint playground
flint:
  backend: vegalite
  theme: economist
---

# Flint

## Bar chart (fenced block)

\`\`\`flint {backend="vegalite"}
{
  "data": {
    "values": [
      { "month": "Jan", "revenue": 120 },
      { "month": "Feb", "revenue": 180 },
      { "month": "Mar", "revenue": 150 },
      { "month": "Apr", "revenue": 210 },
      { "month": "May", "revenue": 190 }
    ]
  },
  "semantic_types": { "month": "Time", "revenue": "Quantity" },
  "chart_spec": {
    "chartType": "Bar Chart",
    "encodings": {
      "x": { "field": "month" },
      "y": { "field": "revenue" }
    },
    "baseSize": { "width": 500, "height": 300 }
  },
  "theme_spec": "economist"
}
\`\`\`

## Scatter plot (directive)

::flint{spec='{"data":{"values":[{"weight":3000,"mpg":18,"origin":"USA"},{"weight":2200,"mpg":28,"origin":"Japan"},{"weight":2500,"mpg":24,"origin":"Europe"},{"weight":3500,"mpg":15,"origin":"USA"},{"weight":1900,"mpg":32,"origin":"Japan"}]},"semantic_types":{"weight":"Quantity","mpg":"Quantity","origin":"Country"},"chart_spec":{"chartType":"Scatter Plot","encodings":{"x":{"field":"weight"},"y":{"field":"mpg"},"color":{"field":"origin"}},"baseSize":{"width":400,"height":300}}}' backend="vegalite" theme="swiss"}
::

## Bound spec (resolved from frontmatter)

::flint{:spec="kpiChart" backend="vegalite"}
::
`

// Add a kpiChart in frontmatter for the bound spec example
const contentWithBoundSpec = content

const tree = await parseMarkdown(contentWithBoundSpec, { plugins: [flint()] })

console.log('frontmatter:', tree.frontmatter)
console.log('flint meta:', tree.meta?.flint)
console.log(
  'nodes:',
  tree.nodes.map((n) =>
    Array.isArray(n)
      ? [n[0], Object.keys((n[1] as Record<string, unknown>) ?? {})]
      : typeof n,
  ),
)
