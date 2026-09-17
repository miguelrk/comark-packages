# comark-packages

pnpm workspace for Miguelrk Comark add-ons: **plugins** and **output renderers**.

## Packages

| Package | Kind | Description |
| --- | --- | --- |
| `comark-arrow` | plugin | ArrowJS sandboxed widgets |
| `comark-etiket` | plugin | Barcode and QR codes via etiket |
| `comark-fetch` | plugin | Frontmatter fetch into meta |
| `comark-flint` | plugin | Flint charts (Vega-Lite / ECharts) |
| `comark-kv` | plugin | unstorage-backed key-value model |
| `comark-vega` | plugin | Vega and Vega-Lite charts |
| `comark-email` | renderer | Email HTML via MJML |
| `comark-pdf` | renderer | PDF output via jasy |

## Setup

```bash
pnpm install
```

## Commands

From the repo root:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Run a script in one package:

```bash
pnpm --filter comark-flint build
pnpm --filter comark-flint-playground dev
```

## Layout

```text
packages/plugins/     # Parse plugins (ComarkPlugin)
packages/renderers/   # Output renderers (markdown → fixed format)
```

Each package may include a private `playground/` Nuxt app for local development.

## Plugins vs renderers

Comark has two extension layers. This repo splits folders to match them.

| Layer | API | Folder | Example |
| --- | --- | --- | --- |
| Parse plugin | `defineComarkPlugin` → `plugins: []` | `packages/plugins/` | `comark-fetch`, `comark-flint` |
| Output renderer | `createXRenderer()` → bytes or string | `packages/renderers/` | `comark-email`, `comark-pdf` |

**Rule of thumb:** if the main export is a plugin factory, put it in `plugins/`. If the main export turns markdown into one output format (email HTML, PDF bytes), put it in `renderers/`.

### They are not 100% separate

- **Hybrid plugins** (`comark-arrow`, `comark-flint`, `comark-vega`, `comark-kv`) also ship subpaths such as `./vue` or `./html`. Those are component handlers for render time, not output renderers. They stay in `plugins/`.
- **Renderers use plugins internally.** `comark-pdf` and `comark-email` accept `plugins: []` and ship format-specific handlers under `./plugins/*` (jasy/MJML adapters, not parse plugins).
- **A plugin does not become a renderer.** Different primary API and consumer intent. A chart plugin may add `/vue` handlers; it does not become `createPdfRenderer`.
- **A renderer does not become a plugin.** It already wraps parsing plus format output.

### Adding a new package

| You are building… | Put it in… |
| --- | --- |
| Parse-time syntax, meta, AST nodes | `packages/plugins/` |
| Markdown → email, PDF, or another fixed format | `packages/renderers/` |
| Nuxt module, CLI, or app integration only | Not here yet (future `integrations/` if needed) |

## Follow-ups

- Initialize git and add GitHub remote `miguelrk/comark-packages`
- Publish a package: `pnpm --filter <name> publish`
- Per-repo GitHub Pages URLs from the old standalone repos do not move automatically; plan a multi-path Pages deploy or keep old repos as redirects
