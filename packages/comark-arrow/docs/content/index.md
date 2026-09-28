---
seo:
  title: comark-arrow — sandboxed ArrowJS widgets for Comark
  description: Turn ```arrow fences and ::arrow directives into live QuickJS widgets. No upfront registration — agent-authored source runs in @arrow-js/sandbox.
---

::u-page-hero
---
orientation: horizontal
---
#title
Sandboxed [ArrowJS]{.text-primary} widgets for Comark

#description
A [Comark](https://comark.dev) plugin for [ArrowJS](https://arrow-js.com). Turn a ` ```arrow ` fence or `::arrow` directive into a live, interactive widget — with **no upfront component registration**. Agent-authored source runs inside `@arrow-js/sandbox` (QuickJS/WASM), not in the host page realm.

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
  ![comark-arrow — ArrowJS sandboxes for Comark](/og.png)
::

::u-page-section
#title
Live widgets from markdown

#features
  :::u-page-feature
  ---
  icon: i-lucide-code-2
  title: Fenced blocks and directives
  description: Write ` ```arrow ` fences with optional ` ```arrow-css `, or bind with `::arrow{:source="..."}`. Both emit the same AST node.
  to: /guide/syntax
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-radio
  title: Streaming-safe
  description: Incomplete frames stay non-executable while the host streams. Pending sandboxes show a placeholder and never boot the VM.
  to: /guide/streaming
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-plug
  title: Host bridge
  description: Expose allowlisted host functions to sandboxed code. Bridge functions never go on the AST — supply them from the app.
  to: /guide/host-bridge
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-shield
  title: Sandboxed execution
  description: Agent-authored source runs only inside QuickJS/WASM. Isolation is not correctness — review generated widgets like generated numbers.
  to: /guide/security
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-file-output
  title: Static fallbacks
  description: HTML, ANSI, PDF, and email targets must not boot the VM. Use `comark-arrow/html` and fence attrs for source, placeholder, or caption.
  to: /guide/static-fallbacks
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-package
  title: Parse or render
  description: Use the core plugin for AST-only parsing, or `comark-arrow/vue` with `ArrowSandbox` for interactive widgets in the browser.
  to: /getting-started/usage
  ---
  :::
::
