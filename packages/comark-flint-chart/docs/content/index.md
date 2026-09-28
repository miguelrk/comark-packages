---
seo:
  title: comark-flint-chart — Flint charts for Comark
  description: A Comark plugin for Flint charts. Compiles ChartAssemblyInput specs into backend-native charts and emits a Flint component node.
---

::u-page-hero
---
orientation: horizontal
---
#title
Flint charts [in Comark]{.text-primary}

#description
A [Comark](https://comark.dev) plugin for [Flint](https://github.com/microsoft/flint-chart) charts. Compiles Flint specs into backend-native charts and emits a `<Flint>` component node. Ships a Vue renderer; parse-time SVG/img is opt-in for static docs.

#links
  :::u-button
  ---
  size: xl
  to: /getting-started/introduction
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  size: xl
  to: /play
  variant: subtle
  icon: i-lucide-square-play
  ---
  Open the playground
  :::

#default
  ::og-image{alt="comark-flint-chart — Flint charts for Comark"}
  ::
::

::u-page-section
#title
What you can do

#features
  :::u-page-feature
  ---
  icon: i-lucide-bar-chart-3
  title: Author charts two ways
  description: "Fenced ```flint blocks for static JSON specs, or ::flint directives with bound :spec paths."
  to: /guide/dual-syntax
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layers
  title: Pick a backend
  description: "Vega-Lite (default), ECharts, Chart.js, Plotly, or Excel — each with its own assembler and SSR support."
  to: /guide/backends
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-component
  title: Render with Vue
  description: "Default output is a Flint component node. Register the shipped Vue renderer for interactive charts."
  to: /getting-started/usage
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-image
  title: Export static SVG
  description: "Opt in to output: svg or img for parse-time static docs and PDF pipelines."
  to: /guide/output-modes
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-file-json
  title: Set frontmatter defaults
  description: "Global backend, theme, output, width, and height under flint: in document frontmatter."
  to: /guide/frontmatter
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-braces
  title: Bind specs at parse or render time
  description: "Literal JSON compiles at parse time; :spec=\"live.data\" stays in the AST for the renderer."
  to: /guide/bindings
  ---
  :::
::
