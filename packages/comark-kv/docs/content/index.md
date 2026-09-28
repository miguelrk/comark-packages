---
seo:
  title: comark-kv — KV for Comark
  description: Declare kv in frontmatter, backed by unstorage, with a live writable kv namespace for two-way ::prop model binding.
---

::u-page-hero
---
orientation: horizontal
---
#title
Live [KV]{.text-primary} from frontmatter

#description
A [Comark](https://comark.dev) plugin that declares a `kv:` block in frontmatter, backed by [unstorage](https://unstorage.unjs.io), and exposes a live writable `kv.*` namespace for two-way `::prop` model binding.

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
  ![comark-kv — KV for Comark](/og.png)
::

::u-page-section
#title
Two forms, one model

#features
  :::u-page-feature
  ---
  icon: i-lucide-database
  title: Single-driver
  description: One storage backend. Model paths are `kv.key`.
  to: /guide/frontmatter-single-driver
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layers
  title: Multi-driver
  description: Each namespace has its own driver. Model paths are `kv.ns.key`.
  to: /guide/frontmatter-multi-driver
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-braces
  title: Runtime model
  description: Framework-agnostic `createKvModel` with get/set on `kv.*` paths.
  to: /guide/runtime-model
  ---
  :::

  :::u-page-feature
  ---
  icon: i-simple-icons-vuedotjs
  title: Vue composable
  description: `useKvModel` bridges the runtime model into Vue templates.
  to: /guide/vue
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-plug
  title: Inject drivers
  description: Pass custom unstorage drivers for testing and SSR.
  to: /guide/drivers
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-git-merge
  title: Conflict handling
  description: Last-write-wins at the whole-value level per namespace.
  to: /reference/conflict-handling
  ---
  :::
::
