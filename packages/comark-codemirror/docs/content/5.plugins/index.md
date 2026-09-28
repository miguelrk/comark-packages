---
title: Plugins
description: comark's defaults, built-ins and ecosystem plugins, for the editor.
navigation:
  icon: i-lucide-puzzle
---

Editor plugins have the same names as comark's parser plugins. They add knowledge — components, completions, snippets, binding scopes, lint, hover, commands and a syntax note for agents — not machinery.

```ts
import { comark } from 'comark-codemirror'
import mermaid from 'comark-codemirror/plugins/mermaid'
import { presetBuiltins } from 'comark-codemirror/presets/builtins'
import { presetEcosystem } from 'comark-codemirror/presets/ecosystem'

comark({ plugins: [...presetBuiltins(), ...presetEcosystem(), mermaid()] })
```

- **Defaults** are registered automatically (like comark): alert, attributes, components, frontmatter, html, task-list. Disable with `registerDefaultPlugins: false`.
- **Built-ins**: `presetBuiltins()` or one by one from `comark-codemirror/plugins/<name>`.
- **Ecosystem** (comark-packages): `presetEcosystem()`.
- A later plugin with the same name replaces an earlier one; `enforce: 'pre' | 'post'` orders them.

Each plugin has a page with what it adds.
