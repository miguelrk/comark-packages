---
seo:
  title: comark-pdf — PDF renderer for Comark
  description: Convert Comark Markdown to print-ready PDF bytes via jasy — no headless browser required.
---

::u-page-hero
---
orientation: horizontal
---
#title
Print-ready [PDF]{.text-primary} from Comark

#description
PDF renderer for [Comark](https://comark.dev). Convert Markdown to PDF bytes via [jasy](https://jasy.dev) — no headless browser required.

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
  ![comark-pdf — PDF renderer for Comark](/og.png)
::

::u-page-section
#title
Three layers, one pipeline

#features
  :::u-page-feature
  ---
  icon: i-lucide-file-text
  title: Comark parses
  description: CommonMark, GFM, components, bindings, and frontmatter become an AST.
  to: /getting-started/introduction
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layers
  title: comark-pdf maps
  description: Read the AST, choose policy, and call jasy primitives — fonts, chrome, visuals, and custom components.
  to: /guide/options-frontmatter
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-printer
  title: jasy draws
  description: Layout and pagination without parsing Markdown, Mermaid, KaTeX, or Shiki.
  to: /reference/syntax-matrix
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-globe
  title: Locale files
  description: One markdown file per locale. Bind only the key that file owns — no `||` fallbacks.
  to: /guide/locale-files
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-puzzle
  title: Plugins and components
  description: Math, Mermaid, binding, and host-owned jasy factories for barcodes or charts.
  to: /guide/plugins
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-monitor
  title: Browser preview
  description: Mount PDF bytes in the DOM with a Blob URL — revoke when done.
  to: /guide/browser-preview
  ---
  :::
::
