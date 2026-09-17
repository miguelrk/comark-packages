<script setup lang="ts">
import { parseMarkdown } from 'comark'
import { renderMarkdown } from 'comark/render'
import flint, { Flint } from 'comark-flint/vue'
import type { FlintPluginMeta } from 'comark-flint'

useHead({ title: 'Playground' })

const template = ref(`---
kpiChart:
  data:
    values:
      - region: North
        units: 340
      - region: South
        units: 290
      - region: East
        units: 410
      - region: West
        units: 375
  semantic_types:
    region: Nominal
    units: Quantity
  chart_spec:
    chartType: Bar Chart
    encodings:
      x:
        field: region
      y:
        field: units
    baseSize:
      width: 480
      height: 300
---

# Flint Plugin

Charts are compiled at parse time — the Flint spec is assembled into a
backend-native spec (Vega-Lite, ECharts, …) before the page renders.

## Bar chart — Vega-Lite backend

\`\`\`flint backend="vegalite" theme="economist"
{
  "data": {
    "values": [
      { "month": "Jan", "revenue": 120000 },
      { "month": "Feb", "revenue": 180000 },
      { "month": "Mar", "revenue": 150000 },
      { "month": "Apr", "revenue": 210000 },
      { "month": "May", "revenue": 190000 },
      { "month": "Jun", "revenue": 240000 }
    ]
  },
  "semantic_types": { "month": "Time", "revenue": "Money" },
  "chart_spec": {
    "chartType": "Bar Chart",
    "encodings": {
      "x": { "field": "month" },
      "y": { "field": "revenue" }
    },
    "baseSize": { "width": 560, "height": 320 }
  },
  "theme_spec": "economist"
}
\`\`\`

## Scatter plot — Swiss theme

\`\`\`flint backend="vegalite" theme="swiss"
{
  "data": {
    "values": [
      { "weight": 3000, "mpg": 18, "origin": "USA" },
      { "weight": 2200, "mpg": 28, "origin": "Japan" },
      { "weight": 2500, "mpg": 24, "origin": "Europe" },
      { "weight": 3500, "mpg": 15, "origin": "USA" },
      { "weight": 1900, "mpg": 32, "origin": "Japan" },
      { "weight": 2800, "mpg": 20, "origin": "Europe" }
    ]
  },
  "semantic_types": { "weight": "Quantity", "mpg": "Quantity", "origin": "Country" },
  "chart_spec": {
    "chartType": "Scatter Plot",
    "encodings": {
      "x": { "field": "weight" },
      "y": { "field": "mpg" },
      "color": { "field": "origin" }
    },
    "baseSize": { "width": 480, "height": 320 }
  },
  "theme_spec": "swiss"
}
\`\`\`

## Line chart — ECharts backend

\`\`\`flint backend="echarts"
{
  "data": {
    "values": [
      { "quarter": "Q1 2024", "sales": 420 },
      { "quarter": "Q2 2024", "sales": 580 },
      { "quarter": "Q3 2024", "sales": 510 },
      { "quarter": "Q4 2024", "sales": 690 },
      { "quarter": "Q1 2025", "sales": 620 }
    ]
  },
  "semantic_types": { "quarter": "Time", "sales": "Quantity" },
  "chart_spec": {
    "chartType": "Line Chart",
    "encodings": {
      "x": { "field": "quarter" },
      "y": { "field": "sales" }
    },
    "baseSize": { "width": 560, "height": 300 }
  }
}
\`\`\`

## Bound spec from frontmatter (directive syntax)

::flint{:spec="kpiChart" backend="vegalite" theme="pop"}
::
`)

const debouncedTemplate = ref(template.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(template, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debouncedTemplate.value = value), 120)
})

const plugins = [flint()]

const { data: result, error } = await useAsyncData(
  'play',
  async () => {
    const tree = await parseMarkdown(debouncedTemplate.value, {
      plugins,
    })
    const flintMeta = (tree.meta.flint as FlintPluginMeta['flint'] | undefined) ?? {
      count: 0,
      backends: [],
    }
    const serializable = JSON.parse(
      JSON.stringify(tree, (_key, value) => (typeof value === 'function' ? undefined : value)),
    ) as typeof tree
    const markdown = await renderMarkdown(serializable)
    return { markdown, flintMeta }
  },
  {
    watch: [debouncedTemplate],
    getCachedData: (key, nuxtApp, { cause }) =>
      cause === 'initial' ? nuxtApp.payload.data[key] : undefined,
  },
)

const flintMeta = computed(
  () => result.value?.flintMeta ?? { count: 0, backends: [] },
)

const view = ref<'preview' | 'markdown'>('preview')
const components = { Flint }
</script>

<template>
  <main class="workbench">
    <section class="inputs">
      <label class="field">
        <span class="label">Markdown <small>flint · compiled at parse time</small></span>
        <textarea v-model="template" rows="42" spellcheck="false" />
      </label>
    </section>

    <section class="output">
      <div class="toolbar" role="group" aria-label="Output view">
        <button type="button" :aria-pressed="view === 'preview'" @click="view = 'preview'">Preview</button>
        <button type="button" :aria-pressed="view === 'markdown'" @click="view = 'markdown'">Generated Markdown</button>
        <span class="status">
          <template v-if="flintMeta.count">
            {{ flintMeta.count }} chart(s) · {{ flintMeta.backends.join(', ') }}
          </template>
          <template v-else>no charts</template>
        </span>
      </div>

      <div v-if="view === 'preview'" class="document prose">
        <Markdown :value="debouncedTemplate" :plugins="plugins" :components="components" />
      </div>
      <pre v-else class="source"><code>{{ result?.markdown }}</code></pre>

      <ul v-if="error" class="diagnostics">
        <li class="error">{{ error.message }}</li>
      </ul>
    </section>
  </main>
</template>
