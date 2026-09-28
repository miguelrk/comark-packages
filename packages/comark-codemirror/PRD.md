# comark-codemirror — PRD

> A source editor for Comark where you can autocomplete everything: blocks, components, props, prop values, slots, bindings like `{{ frontmatter.title }}`, and all core and plugin syntax.
> Completion menus chain into each other, so writing a component feels like walking a nested menu.
> Built as CodeMirror 6 extensions. The document is always plain Comark text.

Status: **implemented** (phases 0–9; phase 10 partly — see §16).

---

## 0. Decisions

| Topic | Decision |
|---|---|
| **Product** | A **code editor** for Comark. The user always sees and edits source. No live mode, no widgets that replace text, no rich-text surface. |
| **Engine** | **CodeMirror 6.** Document, transactions, history, multiple cursors, virtualization, IME, and **EditContext input on Chromium** (`@codemirror/view` 6.43+). |
| **Headline feature** | **Chained autocompletion** built on `@codemirror/autocomplete`: one context-aware completion source, menus that reopen for the next step (`activateOnCompletion`), a breadcrumb section header, drill-in keys, and a rich info panel (§6–§7). |
| **Coverage goal** | Every place in a Comark document where the next token comes from a known set gets a menu. "100%" is measured, not claimed: a **recall test over comark's 228 SPEC fixtures** (§11). |
| **Package** | `comark-codemirror` — one `comark()` extension and optional `./agent`, `./vite`, `./plugins/*`, `./presets/*` subpaths. |
| **Dependencies** | Zero runtime dependencies. CodeMirror packages are peer dependencies; the host already has them. `@codemirror/lang-yaml` is a **required** peer (auto-installed by npm ≥ 7 and pnpm, deduped with the host's CodeMirror) for frontmatter and component props. `rangi` and `shiki` are optional peers. `comark` is not needed at runtime. |
| **Plugins** | Small declarative objects in the style of comark, Vite and UnoCSS: `components`, `scopes`, `completions`, `snippets`, `languages`, `lint`, `hover`, `commands`, `llms`, plus `extensions` as the CodeMirror escape hatch (§8). |
| **AX** | The completion engine also runs headless. Agents can ask "what is valid at this position?" (`complete()`) in addition to the edit tools (`replace`, `edit`, `runCommand`), `snapshot()` and `llms()` (§10). |
| **Docs / tests** | Docus v5 site with `/play` playground. Vitest: node tests on `EditorState` plus browser-mode interaction and screenshot tests for the menus (§11–§12). |
| **YAML** | `@codemirror/lang-yaml` is a required peer. The grammar nests it with `parseMixed`; a small YAML reader (`document/yaml.ts`) turns frontmatter and props into values for bindings. |
| **`/` trigger** | On by default; the `/` is removed on accept (`completion.slash: false` turns it off). |

---

## 1. Goals and non-goals

### Goals

1. **Autocomplete everything.** Components, props, prop values, bound props, slots, YAML props, frontmatter keys and values, binding paths, emoji, alerts, footnotes, link anchors, fence languages and meta, HTML tags, math commands, plus every snippet a plugin adds.
2. **Chained, nested-menu UX.** Picking an item moves the cursor to the next completable spot and opens that menu. Example: component, then props, then value, then the next prop.
3. **Beautiful by default.** A themed menu with icons, sections, breadcrumbs, type hints, value previews and a docs panel, using only CodeMirror's autocomplete APIs.
4. **Correct.** Suggestions match what comark will parse and what the renderer resolves (binding roots, `props` scope, boolean props, `::` model bindings).
5. **Lightweight and composable.** One `comark()` extension. Plugins add knowledge, not machinery.
6. **Headless.** Completion, outline, lint, and edits all run on an `EditorState` in Node, for tests and agents.

### Non-goals

- WYSIWYG, live preview, hidden markers, block widgets, or a preview mode inside the editor. A host can render a preview beside the editor with `@comark/*`.
- A custom text model, view, input stack, virtualization, history, or collaboration layer. CodeMirror covers these (`@codemirror/collab` exists if a host needs it).
- Per-user cursors and undo, suggestion (track-changes) mode, streaming writers, WebMCP.
- Framework adapters in the package. Mounting `EditorView` takes about ten lines in any framework; the docs show Vue and React.
- A general language mode. Fenced code gets highlighting only from languages the host or a plugin passes.

### Principles

- **Factories and plain objects**, no classes in the public API: `comark()`, `definePlugin()`, `defineComponents()`.
- **One source of truth for context.** A single `resolveContext(state, pos)` decides where the cursor is. Completions, hover, lint quick fixes and agents all read it.
- **Quiet by default.** Menus open on syntax triggers only (`::`, `:`, `{`, `"`, `{{`, `#`, `[^`, `](`, `` ``` ``, `<`, `$\`, `> [!`), never on plain prose words, unless the user presses <kbd>Ctrl</kbd>+<kbd>Space</kbd>.
- **Text is the API.** Every completion inserts ordinary Comark. Removing the extension leaves a valid document.

---

## 2. CodeMirror capabilities

Each needed capability, checked against `@codemirror/autocomplete` 6.20.3:

| Needed | CodeMirror API | Verdict |
|---|---|---|
| Menu reopens after a pick (chaining) | `activateOnCompletion(completion) => boolean`: "reactivate completion again as if it was typed" | ✅ native |
| Pick moves cursor, inserts closers | `Completion.apply` as a function, or `snippetCompletion` templates with `${field}` stops | ✅ |
| Commit with a syntax char (`{`, `=`, `.`) | `Completion.commitCharacters` / `CompletionResult.commitCharacters` | ✅ |
| Grouped lists with custom headers (breadcrumb) | `Completion.section` with `CompletionSection.header()` and `rank` | ✅ |
| Extra columns: icons, chevrons, swatches, glyphs, key hints | `addToOptions: [{ render, position }]`, `icons`, `optionClass`, `type` → `.cm-completionIcon-<type>` | ✅ |
| Rich docs panel, async, with cleanup | `Completion.info` returning `Node`, `Promise`, or `{ dom, destroy }`; `positionInfo` | ✅ |
| Fuzzy filtering, ranking, stable menus while typing | Built-in matcher, `boost`, `sortText`, `compareCompletions`, `validFor`, `update`, `map` | ✅ |
| Our own filtering when needed | `CompletionResult.filter: false`, `getMatch` | ✅ |
| Programmatic control | `startCompletion`, `closeCompletion`, `acceptCompletion`, `completionStatus`, `selectedCompletion`, `setSelectedCompletion`, `moveCompletionSelection` | ✅ |
| Per-language sources (frontmatter YAML, fence contents) | Language data `autocomplete` facet, resolved at the cursor's nested language | ✅ |
| Headless use in Node | `new CompletionContext(state, pos, explicit)` needs no view | ✅ |
| **Side-by-side cascading flyout submenus** | Not built in. One list at a time. | ⚠️ emulated |
| Menu opens when Tab moves to a snippet field | Not built in | ⚠️ small wrapper |

**The two gaps are small:**

1. **Flyout submenus.** We use the chain model instead: pick or press <kbd>→</kbd> to go down a level, and <kbd>←</kbd> to go back up. A breadcrumb header shows the path, and the info panel previews the children of the selected item. Keyboard users get the full nested-menu feel. A literal flyout could still be built later as a CodeMirror tooltip (`showTooltip`) next to the list.
2. **Snippet fields.** A <kbd>Tab</kbd> binding with higher precedence calls `nextSnippetField` and then `startCompletion`.

---

## 3. Architecture

```
            ┌──────────────────────── comark() ─────────────────────────┐
 keystroke →│ Lezer: markdown + comarkMarkdown (+ YAML, fence langs)     │
            │        │                                                   │
            │        ▼                                                   │
            │ docIndex (StateField): outline, frontmatter data, headings,│
            │        footnotes, component usages, classes, ids           │
            │        │                                                   │
            │        ▼                                                   │
            │ resolveContext(state, pos) → CursorContext (§4)            │
            │        │                                                   │
            │        ▼                                                   │
            │ completion engine: providers[kind] from plugins            │
            │   → items, sections, chain metadata, info renderers        │
            │        │                                                   │
            │        ▼                                                   │
            │ @codemirror/autocomplete (UI, filtering, keys) + chain.ts  │
            └───────────────────────────────────────────────────────────┘
      lint, hover, commands, and the headless agent API reuse the same context and index
```

### 3.1 Syntax (Lezer)

`comarkMarkdown` extends `markdownLanguage`. Every completable spot is a node, so context resolution reads the tree instead of guessing with regexes:

| Add | Why |
|---|---|
| Attribute children: `AttrOpen`, `AttrClose`, `AttrClass` (`.x`), `AttrId` (`#x`), `AttrName`, `AttrBind` (`:`), `AttrModel` (`::`), `AttrEvent` (`@`), `AttrEquals`, `AttrValue`, `AttrBoolean` | Completion needs to know "key or value, and of which prop". |
| `ComponentProps` for the `---` YAML block directly under an opener, nested as YAML with `parseMixed` | Today this highlights as a thematic break. It is a completion site (§5.3). |
| `Frontmatter` content nested as YAML (`@codemirror/lang-yaml` when installed, otherwise the current `YamlKey`/`YamlValue` nodes) | Real YAML structure for nested keys, lists and values. |
| `FenceInfo`: `FenceLang`, `FenceMeta` (`[filename]`, `{1,3-5}`, `diff`, `twoslash`) | Completion for fence languages and meta. |
| `BindingPath` segments and `BindingDefault` (`\|\| fallback`) | Segment-wise path completion. |
| `SlotAttrs` on `#slot{...}` | Slot attributes (`unwrap`, `preset`, …). |
| `SpanAttrs` on `[text]{...}` and attributes after `**`, `_`, `` ` ``, `~~`, links and images | Attribute completion on inline elements (COMARK `attribute-*` fixtures). |

**Incomplete input is the normal case** during completion (`::card{ti` has no closing brace yet). Rules:

- Tree first, for block context: inside frontmatter, a fence, a math block, a component body (and which components are on the stack), or component props.
- Then a small deterministic scanner over the current line prefix, for inline context. It is anchored at the nearest tree node. One tested function instead of one per plugin.

### 3.2 Conformance

`test/spec/syntax.test.ts` and `scripts/sync-spec.ts` run against comark's SPEC fixtures. For each of the 228 fixtures:

1. Parse with the extended Lezer grammar and assert no error nodes where comark parses cleanly.
2. Assert that block boundaries (component open/close, frontmatter, fences, slots, props blocks) match comark's AST lines, with the same ±1 tolerance for comark's component `$.line`.

This is the base for the completion recall test in §11.

### 3.3 Document index

A `StateField` updated on every change. It only reparses the parts a change touches: frontmatter is reparsed only when the edit hits the frontmatter range.

- `outline`: headings with comark ids, components (name, range, props, slots, depth), fences, math blocks.
- `frontmatter`: the parsed value (YAML subset parser in `document/yaml.ts`, or `lang-yaml`'s tree), plus key ranges for go-to and hover.
- `headings`: id → line, for `](#…)`.
- `footnotes`: defined ids, references.
- `usages`: component names, prop values, classes and ids already used in the document. These are "seen in this document" suggestions when no manifest exists.

---

## 4. Cursor contexts

`resolveContext(state, pos)` returns one discriminated union. Everything completable is listed here; §5 says what each context offers. `|` marks the cursor.

| `kind` | Examples | Notes |
|---|---|---|
| `block` | empty line `\|`, `/\|`, `/tab\|` | Block menu. `/` is an optional trigger that is removed on accept. Inside a component body the menu also lists that component's slots and allowed children. |
| `component-name` | `::ca\|`, `:::\|`, `Hello :ba\|` | Block vs inline comes from the position. The colon count follows the nesting depth. |
| `component-close` | `::\|` on a line inside an open component | Offers the matching closer, e.g. `::` "close card". |
| `attr-key` | `::card{\|`, `::card{title="x" \|`, `#footer{\|`, `[text]{\|`, `**b**{\|` | Owner: component, slot, span or inline mark. |
| `attr-bound-key` | `::card{:\|`, `::card{::\|` | `:` binds one way, `::` two way (model). |
| `attr-value` | `::card{variant="\|` | Enum values, type-based literals, or, for bound keys, binding paths. |
| `attr-class` / `attr-id` | `{.\|`, `{#\|` | Classes and ids from the manifest, the document, or a host provider. |
| `binding-path` | `{{ \|`, `{{ frontmatter.si\|`, `:title="props.\|` | Segment-wise; see §5.5. |
| `binding-default` | `{{ path \|\| \|` | Literal fallback. Offers the current resolved value as a hint. |
| `slot` | `#\|` at the start of a line inside a component | Slots of the innermost component. |
| `props-key` / `props-value` | inside `---` under a component opener | The same props as `attr-key`, in YAML form. |
| `frontmatter-key` / `frontmatter-value` | inside the leading `---` block | From the host's frontmatter JSON Schema, then from keys used in sibling documents if a provider exists. |
| `fence-lang` / `fence-meta` | ```` ```ts\| ````, ```` ```ts [app.ts] {\| ```` | Languages known to the host or plugins; meta forms from the code-blocks and shiki plugins. |
| `fence-body` | inside ```` ```mermaid ```` | Delegated to the nested language's completion (mermaid keywords, json-render specs). |
| `emoji` | `:smi\|` | Shares the trigger with inline components. Both appear in one menu as two sections. |
| `link-url` | `[x](\|`, `[x](#\|`, `![x](\|` | `#` gives heading anchors from the index; host providers give pages and assets. |
| `footnote` | `[^\|` | Defined ids, or "new footnote" which also appends the definition. |
| `alert` | `> [!\|` | `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`. |
| `task` | `- [\|` | `[ ]`, `[x]`. |
| `html-tag` / `html-attr` | `<\|`, `<div \|` | Off unless the html plugin is on. Security plugin settings filter it. |
| `math` | `$\fr\|`, inside `$$` | KaTeX command list (lazy). |
| `inline` | explicit <kbd>Ctrl</kbd>+<kbd>Space</kbd> mid-line | Inline menu: marks, link, image, span, inline component, binding, emoji, math, footnote. |

The type lives in `src/context/types.ts` and is exported. Plugins register providers by `kind`, and agents receive it from `complete()`.

---

## 5. What each menu offers (coverage matrix)

"Chain" is what opens right after accepting. "→" means drill-in is available.

### 5.1 Block menu (`block`)

| Section | Items | Inserts | Chain |
|---|---|---|---|
| Components | manifest block components, by `group` | `::name{\|}` + body + closer; nested depth gets extra colons | `attr-key` (or none if the component has no props) |
| Slots *(in a component)* | `#footer` … | `#footer\n\|` | – |
| Structure | Heading 1–6, bullet, ordered, task list, quote, table, divider `***` | markdown | – |
| Callouts | `> [!NOTE]` … | alert block | – |
| Code | code fence, math block, mermaid, json-render | fence | `fence-lang` for a generic fence |
| Document | frontmatter (line 1 only), summary `<!-- more -->`, footnote definition | template | `frontmatter-key` |
| Plugins | anything plugins add (etiket codes, vega charts, email blocks, page break, flint charts) | from the plugin | per plugin |

### 5.2 Components, props and values

- **Name.** Fuzzy match over manifest names, plus names used in the document (marked "used here"). `commitCharacters: ['{']` accepts and opens props.
- **Props list.** Required props first, then the rest, then `class` / `id` / `style`. Props already set are hidden. Each row shows the type or enum preview as `detail` and the default as a muted hint.
  - Boolean props insert bare `reverse` (comark accepts it) and chain back to `attr-key`.
  - Other props insert `title="\|"` and chain to `attr-value`.
  - Typing `:` or `::` switches the list to bindable props. Picking one inserts `:title="\|"` and chains to `binding-path`.
- **Values.**
  - `enum` values.
  - `boolean` gives `true` / `false` (bound form only: `:disabled="true"`).
  - `number` gives the default.
  - `string` gives values used elsewhere in the document for the same prop.
  - Accepting moves the cursor past the closing quote, inserts a space, and chains back to `attr-key`. Typing `}` ends the chain.
- **Many props.** When more than a set number of props are present (comark's inline-to-YAML threshold), the menu offers "Move props to YAML block". It runs a command that rewrites `{…}` into a `---` props block.

### 5.3 YAML props and frontmatter

- `props-key` offers the same props as attributes, as `title: \|`. Values follow the prop type; objects and arrays insert the YAML shape.
- `frontmatter-key` comes from `frontmatterSchema` (JSON Schema) when the host provides it. Nested objects drill in with →. Enum values come from the schema.

### 5.4 Slots

`#` at the start of a line inside a component lists `slots` of the innermost open component, with each slot's `description`. The default slot is excluded. Slot attributes (`#header{unwrap="p"}`) go through `attr-key` with owner `slot`.

### 5.5 Bindings (`{{ … }}`, `:prop="…"`, `::prop="…"`)

Binding roots match what comark renderers resolve: `resolveAttributes(attrs, { frontmatter, meta, data, props })`. Paths that do not resolve are passed through as strings.

| Root | Keys come from | Shown when |
|---|---|---|
| `frontmatter` | **live** parse of this document's frontmatter (`docIndex.frontmatter`) | always |
| `props` | the nearest enclosing component that has its own attributes: its inline attributes, its YAML props block, and manifest defaults (the renderer's `hasOwnAttrs ? { ...renderData, props }` rule) | inside such a component |
| `data` | host `data` option: a sample object, a JSON Schema, or an async provider | host configured |
| `meta` | host `meta` option or known meta keys | host configured |
| component scopes | a manifest component can declare `scope` (for example `::for{:each="data.posts" item="post"}` introduces `post` with the element type of `data.posts`) | inside that component |

Behavior:

- `{{ |` lists the available roots, each with an icon and a count of keys.
- Picking a root inserts `frontmatter.` and chains to the next segment. `commitCharacters: ['.']` lets you type through.
- Objects show a `›` chevron and drill in. Leaves show the current value as `detail`, for example `site.name  "My Blog"`. Arrays offer indices, and `length` when the host enables it.
- After a complete path plus a space, `||` is offered for a fallback value.
- `::prop="…"` (two-way model) offers only writable roots: `data`, by default.
- Unknown paths get a lint warning ("`frontmatter.titel` does not exist; did you mean `title`?") with a quick fix. Hover shows the resolved value.

### 5.6 Inline and plugin syntax

| Context | Offers | Plugin |
|---|---|---|
| `emoji` | shortcodes with the glyph rendered in the row (`addToOptions`), aliases matched | emoji (data lazy-loaded) |
| `link-url` | `#heading-id` with heading text as detail; host pages and assets | headings, host |
| `footnote` | defined ids with a preview of the definition; "new footnote" | footnotes |
| `alert` | five types, each with its icon and color | alert |
| `task` | `[ ]`, `[x]` | task-list |
| `fence-lang` | languages from `codeLanguages`, shiki's or rangi's list when those plugins are on, plus `mermaid`, `json-render`, `yaml-render`, `math` | code-blocks, shiki, rangi, mermaid, json-render |
| `fence-meta` | `[filename]`, `{1,3-5}` line highlights, `diff`, `twoslash` | code-blocks, shiki, twoslash |
| `math` | KaTeX commands with a rendered-symbol column (the glyph is Unicode where one exists) | math |
| `html-tag` / `html-attr` | HTML tags and attributes, filtered by security settings | html, security |
| `inline` | bold, italic, code, strike, link, image, span `[text]{}`, inline component, binding, emoji, math, footnote | core |

---

## 6. Chaining UX and visuals

### 6.1 The chain

A walk-through of writing a component. `|` marks the cursor after each step.

```
::ca|                      menu: Components › card, callout, carousel …
  ↵ (or type "{")
::card{|}                  menu: card › props   title*  variant  icon  :title …
  ↵ on "variant"
::card{variant="|"}        menu: card › variant   primary  secondary  ghost
  ↵ on "primary"
::card{variant="primary" |}  menu: card › props   title*  icon …
  type ":ti" ↵
::card{variant="primary" :title="|"}  menu: bindings   frontmatter  props  data
  ↵ frontmatter, ↵ site, ↵ name
::card{variant="primary" :title="frontmatter.site.name" |}
  type "}" or Esc          chain ends; the closer and body line were inserted with the opener
```

Mechanics:

- Every completion carries `chain?: ContextKind | true`. `activateOnCompletion: c => !!c.chain` reopens the menu after the pick. Our source then sees the new context and answers even with an empty prefix and `explicit: false`.
- **Drill-in and back.** A keymap at `Prec.highest` is active only while `completionStatus(state) === 'active'`.
  - <kbd>→</kbd> on an item with children accepts it and opens the next level.
  - <kbd>←</kbd> with an empty prefix reverts the last chain step. A small `StateField` keeps the chain stack of `{ changes, context }`.
- <kbd>Esc</kbd> closes the menu and ends the chain. Typing the closing character (`}` `"` `]`) also ends the step.
- Snippet fields: <kbd>Tab</kbd> runs `nextSnippetField` and then `startCompletion` when the field is a completable context.
- Auto-closing pairs are inserted with the opener (`{}`, `""`, `{{ }}`, the component closer) so the document stays valid at every step.

### 6.2 Menu anatomy

```
┌───────────────────────────────────────────────┐
│ ::card › props                          ⌫ back │  ← section header (breadcrumb)
├───────────────────────────────────────────────┤
│ ◆ title        string   required          ›   │  ← icon · label · detail · chevron
│ ◆ variant      primary | secondary | ghost ›  │
│ ◇ icon         string                         │
│ ⚭ :title       bind to data                ›  │
├───────────────────────────────────────────────┤
│ Attributes                                    │
│ · class   · id   · style                      │
└───────────────────────────────────────────────┘
      ┌──────────────── info panel ────────────────┐
      │ variant  — Visual style of the card.        │
      │ primary · secondary · ghost   default: primary│
      │ ::card{variant="ghost"}  (highlighted)      │
      │ docs ↗                                      │
      └─────────────────────────────────────────────┘
```

- **Icons.** One per `type`: `component`, `inline-component`, `prop`, `prop-bound`, `slot`, `value`, `binding-root`, `binding-key`, `binding-leaf`, `emoji`, `alert`, `fence`, `snippet`, `heading`, `footnote`. They are small inline-SVG masks in the theme, not an icon font.
- **Columns** (`addToOptions`):
  - a chevron `›` when `chain` is set;
  - a type or value preview;
  - an emoji glyph, alert color dot or color swatch for color values;
  - the key hint for the selected row (`↵`, `→`).
- **Sections** have fixed ranks: context items first, then "used in this document", then snippets. The header renders the breadcrumb from the chain stack.
- **Info panel** (`info`, async, cached per item): description, props table or enum list, the example rendered as highlighted Comark (`highlightTree` with our highlight style), and a docs link. For bindings it shows the current resolved value. An optional `render` hook lets a host show a live preview with `@comark/html`.

### 6.3 Ranking

- `boost`:
  - required and unset props;
  - items used in this document;
  - recently picked items (session MRU, kept in a `StateField`, never stored).
- `filterStrict` stays off, so fuzzy matching works (`vr` finds `variant`).
- A result with an empty prefix keeps manifest order: groups first, then alphabetical.

### 6.4 Configuration

```ts
comark({
  completion: {
    slash: true,            // "/" at line start opens the block menu
    chain: true,            // reopen after picks
    drill: true,            // → / ← keys
    info: 'auto',           // 'auto' | 'always' | false
    maxItems: 60,
    icons: true,
  },
})
```

`comark()` installs `autocompletion()` with our config and registers its source through **language data**. Hosts must not pass `override` (it would bypass language-data sources). Extra sources should be added with `EditorState.languageData` or as plugins.

### 6.5 Theme

- `comarkTheme` (`EditorView.theme`) styles `.cm-tooltip-autocomplete`, `.cm-completionLabel`, `.cm-completionDetail`, `.cm-completionMatchedText`, `.cm-completionInfo`, section headers, and our columns.
- All colors are CSS variables (`--cme-menu-bg`, `--cme-accent`, …) with light and dark values. Hosts can restyle with CSS only.
- Details: rounded 8px panel, subtle shadow, 28px rows, matched text in the accent color, `prefers-reduced-motion` respected, width that grows with content up to a limit, and info placed left or right based on space (`positionInfo`).
- `comarkHighlightStyle` provides syntax colors.

---

## 7. Component manifest

### 7.1 Type

```ts
interface ComponentDef {
  name: string
  kind: 'block' | 'inline' | 'both'
  description?: string
  group?: string                               // block-menu section
  props?: Record<string, PropDef>
  slots?: { name: string, description?: string }[]
  children?: string[]                          // allowed child components (optional constraint)
  scope?: Record<string, ScopeSpec>            // binding names this component introduces, e.g. for loops
  example?: string
  docs?: string
}
interface PropDef {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
  enum?: readonly (string | number | boolean)[]
  required?: boolean
  default?: unknown
  description?: string
  bindable?: boolean                           // default true
  model?: boolean                              // accepts ::prop two-way binding
}
```

A legacy host shape with props as an array of `{ name, values }` is accepted and normalized.

### 7.2 Sources, merged by name (later wins)

1. Plugin manifests (binding `if`/`for`, etiket, vega, email, flint, page-break, …).
2. The `components` option.
3. A host `resolveComponents()` async provider, cached.
4. The Vite plugin's `virtual:comark-codemirror/components`.

### 7.3 Vite plugin (optional)

`comark-codemirror/vite` scans `.vue` (`defineProps`, `withDefaults`, `<slot name>`) and `.tsx`/`.jsx` (props types) into manifests with HMR. It is the only way to get prop types and slots with no manual work.

---

## 8. Plugins

```ts
export interface EditorPlugin {
  name: string
  enforce?: 'pre' | 'post'
  components?: ComponentDef[]
  scopes?: ScopeProvider[]                     // binding roots (§5.5)
  completions?: CompletionProvider[]           // { kinds: ContextKind[], provide(ctx) => Item[] | Promise<Item[]> }
  snippets?: SnippetDef[]                      // { context, label, template, section?, info?, chain? }
  languages?: LanguageDescription[]            // fence languages (lazy)
  lint?: LintSource[]
  hover?: HoverSource[]
  commands?: Record<string, CommandDef>
  keymap?: KeyBinding[]
  llms?: string
  extensions?: Extension[]                     // CodeMirror escape hatch
}
export const definePlugin = <O>(factory: (options?: O) => EditorPlugin) => factory
```

- Resolution works as in comark: the defaults (alert, attributes, components, frontmatter, html, task-list) are registered unless `registerDefaultPlugins: false`. Presets are flattened. A later plugin with the same name replaces an earlier one. `enforce` then orders the list.
- Presets: `presetBuiltins()` and `presetEcosystem()`.
- Built-ins: binding, breaks, code-blocks, emoji, footnotes, headings, json-render, math, mermaid, model, punctuation, rangi, shiki, security, summary, toc, twoslash.
- Ecosystem: etiket, email, flint, page-break, vega.
- Convention (upstream proposal): a comark plugin package may ship `./editor`, exporting its `EditorPlugin`.

---

## 9. Beyond completion

| Feature | API | Notes |
|---|---|---|
| Commands and keymap | core | toggles, headings, lists, tasks, quote, link, insert/wrap/unwrap component, set props, props ↔ YAML, table format |
| Structural lint | `@codemirror/lint` | Unclosed blocks, unknown component, prop or slot, bad enum value, unknown binding path, stray closer, unclosed frontmatter. Each has a quick-fix `Action` where a fix is obvious. |
| Hover | `hoverTooltip` | Component and prop docs, resolved binding values, footnote definitions, heading targets |
| Folding | Lezer | components, frontmatter, fences, props blocks |
| Go to definition | command | binding → frontmatter key; `#anchor` → heading; `[^id]` → definition |
| Outline panel data | `outline(state)` | Hosts render their own table of contents |

---

## 10. Agent experience (AX)

All of these are headless functions on `EditorState` or a string:

- `complete(state, pos, { explicit })` returns `{ context, items: { label, insert, detail, chain }[] }`. An agent can ask "what props does `card` take here?" and get the same answer a user sees.
- `snapshot(state)` returns text with line numbers, outline, frontmatter, diagnostics and selection.
- `replace` (`str_replace` semantics), `edit({ target, mode, content })` with structural targets, `patch`, and `setText` (minimal diff). Each returns a `ChangeSpec`, or `{ ok: false, code, message, candidates }`.
- `runCommand(name, params)` for any registered command.
- `tools()` returns `{ name, description, inputSchema, execute }[]` covering the above plus `complete`.
- `llms()` builds a Markdown cheat sheet from enabled plugins and the manifest.

An agent edit is dispatched with `userEvent: 'agent'`, so hosts can style or filter it, and plain undo works.

---

## 11. Testing (Vitest 4)

| Suite | What |
|---|---|
| `syntax/spec` | 228 SPEC fixtures: clean parse and block boundaries (§3.2) |
| `context` | A table of `text with \| cursor` → expected `CursorContext`, covering every row of §4, including incomplete input and nesting |
| `complete/*` | Per provider: items, order, `from`/`to`, `validFor`, apply result, chain target |
| **`complete/recall`** | **The "100%" gate.** For each SPEC fixture, for every completable token (component name, prop key, enum value, slot, binding segment, emoji, alert type, fence lang, footnote id, heading anchor), cut the document at the token start and query `complete()`. Pass if the real token is among the items. Fixtures run with a manifest derived from the fixture, and binding fixtures with their own frontmatter. Target: **100% recall, 0 crashes**. Also random cut points, checked with fast-check. |
| `chain` (browser mode) | Real typing in Chromium, Firefox and WebKit: `::ca` ↵ opens props, → / ← navigation, Esc ends the chain, snippet Tab opens the menu, IME composition does not trigger menus |
| `visual` (browser mode) | Menu and info-panel screenshots, light and dark |
| `lint`, `hover`, `commands`, `agent` | Unit coverage for each API surface |
| `bench` | `resolveContext` and the completion source on a 10k-line document |

---

## 12. Docs (Docus v5)

The Docus site covers:

- **Getting started:** install, `comark()`, mounting in Vue, React and vanilla.
- **Autocomplete:** the tour with animated examples, contexts, chaining keys, configuration, theming.
- **Components:** manifest format, Vite plugin, providers.
- **Bindings:** roots, `props` scope rules, `data`/`meta` providers, component scopes.
- **Plugins:** authoring, and one generated page per plugin.
- **Agents:** `complete`, `tools`, `llms`.
- **Reference:** generated.

The `/play` page shows the editor, a `@comark/html` preview pane, and a "try this" checklist that walks through every context. The `llms-full.txt` route and the agent skill are included.

---

## 13. Budgets

| Metric | Target |
|---|---|
| `resolveContext` + source (sync part) on 10k lines | < 2 ms |
| Menu reopen after a chained pick | same frame (no timer beyond CodeMirror's own) |
| Our code, gzip, excluding CodeMirror and the emoji/KaTeX data | ≤ 25 KB for `comark()` + default plugins |
| Lazy data (emoji, KaTeX commands, language lists) | loaded on first use of that context |
| Runtime dependencies | 0 |

CodeMirror itself is the host's cost. The docs record the measured size of the typical host set (`view`, `state`, `language`, `lang-markdown`, `autocomplete`).

---

## 14. Roadmap

Each phase ends with typecheck, tests and docs updated.

| Phase | Deliverable |
|---|---|
| **0. Scaffolding** | Package layout, SPEC harness, manifest types, emoji data, Vite plugin, agent targets. Peer versions pinned to verified releases (`activateOnCompletion` present). |
| **1. Grammar** | Attribute, props-block, fence-info and binding sub-nodes. YAML nesting. SPEC suite green. |
| **2. Context** | `resolveContext` and its table tests for all of §4. `docIndex` field. |
| **3. Engine** | One source via language data, providers by kind, manifest normalization, core providers: block, component, attributes, values, slots, YAML props, frontmatter. |
| **4. Chain and visuals** | `activateOnCompletion`, drill keys, chain stack, snippet Tab bridge, sections and breadcrumbs, `addToOptions` columns, info panels, theme. Browser and screenshot tests. |
| **5. Bindings** | Scopes (frontmatter, props, data, meta, component scopes), model restrictions, binding lint and hover, go-to-definition. |
| **6. Plugin syntax** | Emoji, alert, footnotes, links and headings, fences and meta, math, mermaid, json-render, html and security, task-list, summary, ecosystem manifests. **Recall gate at 100%.** |
| **7. Editing** | Commands, keymap, lint quick fixes, hover. |
| **8. AX** | `complete`, `snapshot`, edits, `tools()`, `llms()`. |
| **9. Docs** | Docus site, playground, generated reference. |
| **10. Hardening** | Budgets checked in CI, accessibility pass (CodeMirror's listbox ARIA, screen-reader announcement of chain steps), mobile check, 1.0. |

Later candidates, outside this plan: a flyout submenu tooltip, UnoCSS/Tailwind class completion providers, suggestion review for agent edits, and yjs through `@codemirror/collab`.

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Lezer's view of incomplete input differs from comark's | Block context from the tree, inline context from the line scanner; context table tests over incomplete prefixes. |
| Chained menus feel noisy | Chains only follow explicit picks. Esc always ends the chain. `completion.chain: false` turns it off. |
| `activateOnCompletion` re-queries with `explicit: false` | Our source decides by context, not by prefix length. Tested. |
| Hosts also pass `autocompletion({ override })` | Documented: use language data instead of override when using `comark()`. |
| Frontmatter parse cost on large YAML | Reparsed only when an edit touches the frontmatter range. |
| Manifest drift from real components | Vite plugin; lint marks unknown props as warnings, not errors. |

---

## 16. Status

**Verified:** typecheck; 610 node tests and 27 browser tests (9 each in Chromium, Firefox and WebKit); build; size check; static docs generation.

| Area | Result |
|---|---|
| SPEC conformance | 228/228 fixtures parse; every comark top-level block ends where a syntax-tree or outline block ends. |
| Recall gate (§11) | **399/399** completable tokens in the fixtures (component names 139, props 54, values 36, fence languages 40, slots 25, YAML prop keys 17, binding segments 50, emoji 21, alerts 10, tasks 7); 1,500 random positions never throw. |
| Latency (10k lines, 1,000 components) | resolve + source with a warm index: ~0.02 ms. First request after an edit (index rebuilt): ~3.4 ms — over the 2 ms target for this dense document; the footnote/usage scan is lazy. |
| Size (gzip, CodeMirror external) | `comark()` + defaults 26.9 KB (target was 25; budget set to 27), all plugins 34.4 KB (+2.9 KB lazy emoji data), agent API 26.6 KB. |

Implementation notes:

- **Context kinds.** `component-close` is not a separate kind: `component-name` carries the component that `::` would close, and the menu shows the closer first. Emoji shortcodes that start with a letter share `component-name` (inline) with inline components, as two sections; `emoji` is the kind for `:+1`-style shortcodes. `attr-class` and `attr-id` are separate kinds.
- **Block context** comes from the document index (outline stack, regions) plus the syntax tree for code spans, comments and indented code, instead of reading every region from the tree. The attribute and binding sub-nodes of the grammar drive highlighting; cursor position inside them comes from the shared attribute tokenizer.
- **Grammar fixes found by the fixtures:** content inside components never becomes an indented code block, and a closer only closes a component whose opener is at the same or a deeper indentation (innermost-first, like comark). An empty `{{}}` is not a binding (also like comark; it avoided a WebKit caret bug).
- **Section order.** The breadcrumb and closer sections are fixed on top; all other sections are ranked by their best match (`rank: 'dynamic'`), with small section boosts ordering them when nothing is typed yet. Fixed ranks let weak matches in early sections beat exact ones.
- **Commit keys** are handled by the editor (accept and swallow), not CodeMirror's `commitCharacters`, which would type the character after inserting it. <kbd>Tab</kbd> also accepts.
- **Command catalog** (names, descriptions, JSON Schemas) lives in the agent entry, not the main bundle.
- **Not built:** an async `resolveComponents()` option (reconfigure `comark()` in a `Compartment` instead, documented); `props ↔ YAML` only goes to YAML (`propsToYaml`); go-to-definition; a `render` hook for live previews in the docs panel; the session MRU boost; the dev-mode warning for `autocompletion({ override })` (not reliably detectable); pixel-baseline screenshots (browser tests assert the menu DOM and save screenshots instead).
- **Docs and playground.** The Docus site is the package site; `/play` is the playground (editor, `@comark/html` preview, clickable tour, agent tools, problems, `llms()`).
- **Phase 10:** CI installs Chromium, runs the browser tests and the size budgets. Not done: screen-reader announcements for chain steps, manual mobile and IME checks.
