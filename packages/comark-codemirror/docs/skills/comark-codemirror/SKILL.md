---
name: comark-codemirror
description: Build with comark-codemirror, the Comark code editor for CodeMirror 6 with chained autocompletion for components, props, values, slots, bindings and plugin syntax. Use when adding comark() to a CodeMirror editor, writing component manifests or editor plugins, configuring binding data, or editing Comark documents from an agent (complete, tools, structural targets).
---

# comark-codemirror

A CodeMirror 6 extension. The document is always plain Comark text.

## Setup

```ts
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'
import { comark } from 'comark-codemirror'
import { presetBuiltins } from 'comark-codemirror/presets/builtins'

new EditorView({
  parent,
  doc,
  extensions: [basicSetup, comark({
    plugins: presetBuiltins(),
    components: [{ name: 'card', kind: 'block', props: { title: { type: 'string', required: true }, variant: { enum: ['soft', 'outline'] } }, slots: [{ name: 'footer' }] }],
    data: { user: { name: 'Ada' } },            // `data.*` bindings (or dataSchema)
    frontmatterSchema: { type: 'object', properties: { title: { type: 'string' } } },
  })],
})
```

- Do not pass `autocompletion({ override })`: comark registers its source through language data.
- Reconfigure options with a `Compartment`.

## Manifest

`ComponentDef`: `name`, `kind` (`block`/`inline`/`both`), `props` (keyed without `:`; `type`, `enum`, `required`, `default`, `description`, `bindable` default true, `model` default false), `slots`, `children`, `scope` (loop variables), `group`, `example`, `docs`. `comark-codemirror/vite` generates it from Vue/React components (`virtual:comark-codemirror/components`).

## Plugins

`definePlugin(() => ({ name, components, completions: [{ kinds, provide }], snippets, scopes, lint, hover, commands, fences, llms, extensions }))`. Items: `label`, `insert` (`$0`, `${1:x}`; braces literal), `chain` (reopen menu), `drill`, `commit`, `exit`, `detail`, `info`, `type`, `section`.

## Agents (`comark-codemirror/agent`)

- `complete(state, pos)` → `{ context, items }`: what is valid at a position.
- `snapshot(state, { around? })`, `llms(state)`.
- Edits return `Edit` (`{ ok, changes }` or `{ ok: false, code, message, candidates }`): `replace({ search, replace, occurrence?, all? })`, `edit({ target, mode, content })`, `patch(diff)`, `setText(text)`, `runCommand(name, params)`.
- Targets: `{ line }`, `{ lines }`, `{ heading }`, `{ section }`, `{ component, index?, where? }`, `{ slot, component? }`, `{ frontmatter }`, `{ text, occurrence? }`, `{ range }`.
- `tools(view)` → `{ name, description, inputSchema, execute }[]` (read, complete, syntax, replace, edit, patch, setText, every command).

## Comark syntax cheat sheet

- Block component: `::card{title="Hi" .x #id :bound="frontmatter.a" ::model="data.b" flag}` … `::`; nest with more colons; `#slot` lines; YAML props between `---` right under the opener.
- Inline component: `:badge[text]{color="red"}`.
- Bindings: `{{ frontmatter.title || fallback }}`; roots `frontmatter`, `props`, `data`, `meta`.
- Attributes after inline elements: `**b**{.x}`, `[span]{.x}`, `## Title {#id}`.
- Alerts `> [!NOTE]`, tasks `- [ ]`, footnotes `[^1]`, math `$x$`, fences ```` ```ts [file.ts] {1,3} ````.
