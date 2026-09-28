---
seo:
  title: comark-codemirror — autocomplete everything in Comark
  description: A Comark code editor for CodeMirror 6. Components, props, values, slots, bindings and every plugin's syntax complete in chained menus.
---

::u-page-hero
---
orientation: horizontal
---
#title
Autocomplete [everything]{.text-primary} in Comark

#description
A code editor for [Comark](https://comark.dev), built on CodeMirror 6. Type `::` and walk from a component to its props, their values and the next prop in one chain of menus. Bindings like `{{ frontmatter.title }}` complete from the document itself.

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
  :::editor-demo{demo="tour" height="360px"}
  :::
::

::u-page-section
#title
One chain of menus for the whole language

#features
  :::u-page-feature
  ---
  icon: i-lucide-list-tree
  title: Chained menus
  description: Picking a component opens its props; a prop opens its values; a value returns to the next prop. → drills in, ← goes back.
  to: /autocomplete/chaining
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-braces
  title: Bindings that know your data
  description: "`{{ frontmatter.* }}` from the live frontmatter, `props.*` from the enclosing component, `data.*`, `meta.*` and loop variables."
  to: /bindings/roots
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-check-check
  title: Measured coverage
  description: Every completable token in comark's 228 SPEC fixtures is offered by the menu — a test, not a claim.
  to: /autocomplete/contexts
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-puzzle
  title: Plugins add knowledge
  description: comark's defaults, built-ins and ecosystem plugins contribute components, snippets, scopes and lint — small declarative objects.
  to: /plugins
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-bot
  title: Agents ask the same menu
  description: "`complete()` tells an agent what is valid at a position; `tools()` edits by structure, not offsets."
  to: /agents/overview
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-feather
  title: Just CodeMirror
  description: One `comark()` extension next to `basicSetup`. No second editor, no framework lock-in, zero runtime dependencies.
  to: /getting-started/usage
  ---
  :::
::
