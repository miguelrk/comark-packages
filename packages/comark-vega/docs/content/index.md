---
seo:
  title: comark-vega — Vega charts for Comark
  description: A Comark plugin for Vega and Vega-Lite — fenced blocks and directives become chart component nodes with a shipped Vue renderer.
---

::u-page-hero
---
orientation: horizontal
---
#title
[Vega charts]{.text-primary} for Comark

#description
A [Comark](https://comark.dev) plugin for [Vega](https://vega.github.io/vega/) and [Vega-Lite](https://vega.github.io/vega-lite/). Fenced blocks and directives become `Vega` component nodes — with a shipped Vue renderer or opt-in parse-time SVG.

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
  ::og-image{alt="comark-vega — Vega charts for Comark"}
  ::
::

::u-page-section
#title
Two ways to embed charts

#features
  :::u-page-feature
  ---
  icon: i-lucide-braces
  title: Fenced specs
  description: "````vega-lite` blocks hold raw JSON — opaque to the parser, safe for `{…}`."
  to: /guide/entry-points
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-link
  title: Bound directives
  description: "`::vega{:spec=\"report.chart\"}` preserves bindings for `@comark/binding`."
  to: /guide/bindings
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-image
  title: Inline SVG
  description: "`::vl`, `::vg`, and `::chart` render SVG at parse time for static docs."
  to: /guide/inline-svg
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-vuejs
  title: Vue renderer
  description: "`comark-vega/vue` ships a `<Vega>` component for interactive apps."
  to: /getting-started/usage
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-bar-chart-3
  title: Mark shortcuts
  description: "`::chart-bar`, `::chart-line`, and 16 more inject the Vega-Lite mark."
  to: /reference/mark-shortcuts
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-shield-alert
  title: Soft failures
  description: Invalid specs show a fallback node — the rest of the document still renders.
  to: /reference/error-handling
  ---
  :::
::
