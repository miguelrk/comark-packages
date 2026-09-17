# comark-packages

pnpm workspace for Packages for Comark

Playgrounds: [miguelrk.github.io/comark-packages](https://miguelrk.github.io/comark-packages/)

## Packages

| Package | Kind | Playground | Description |
| --- | --- | --- | --- |
| `comark-arrow` | plugin | [open](https://miguelrk.github.io/comark-packages/comark-arrow/) | ArrowJS sandboxed widgets |
| `comark-etiket` | plugin | [open](https://miguelrk.github.io/comark-packages/comark-etiket/) | Barcode and QR codes via etiket |
| `comark-fetch` | plugin | [open](https://miguelrk.github.io/comark-packages/comark-fetch/) | Frontmatter fetch into meta |
| `comark-flint` | plugin | [open](https://miguelrk.github.io/comark-packages/comark-flint/) | Flint charts (Vega-Lite / ECharts) |
| `comark-kv` | plugin | [open](https://miguelrk.github.io/comark-packages/comark-kv/) | unstorage-backed key-value model |
| `comark-vega` | plugin | [open](https://miguelrk.github.io/comark-packages/comark-vega/) | Vega and Vega-Lite charts |
| `comark-email` | renderer | [open](https://miguelrk.github.io/comark-packages/comark-email/) | Email HTML via MJML |
| `comark-pdf` | renderer | [open](https://miguelrk.github.io/comark-packages/comark-pdf/) | PDF output via jasy |

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
pnpm generate
```

`generate` builds every playground for GitHub Pages.

Run a script in one package. Do not copy package scripts to the root. All packages share the same names.

```bash
pnpm --filter comark-flint build
pnpm --filter comark-flint play
pnpm --filter comark-flint-playground dev
pnpm --dir packages/comark-flint play
```

## Release

Each package still uses `release-it`. Run it from the root with `--filter`. Git tags use the package name so they do not collide.

```bash
pnpm --filter comark-flint release
```

That command:

- runs `typecheck` and `test` for that package
- bumps the package version
- creates tag `comark-flint@x.y.z`
- publishes that package to npm
- opens a GitHub release on this repo

## Layout

```text
packages/<name>/
```

Each package may include a private `playground/` Nuxt app for local development.

A package is a **parse plugin** (`defineComarkPlugin` → `plugins: []`) or an **output renderer** (`createXRenderer()` → bytes or string). The kind is in the table above.

- **Hybrid plugins** (`comark-arrow`, `comark-flint`, `comark-vega`, `comark-kv`) also ship subpaths such as `./vue` or `./html`. Those are component handlers for render time, not output renderers.
- **Renderers use plugins internally.** `comark-pdf` and `comark-email` accept `plugins: []` and ship format-specific handlers under `./plugins/*` (jasy/MJML adapters, not parse plugins).

### Adding a new package

Put the new package in `packages/<name>/`.

| You are building… | Kind |
| --- | --- |
| Parse-time syntax, meta, AST nodes | plugin |
| Markdown → email, PDF, or another fixed format | renderer |
| Nuxt module, CLI, or app integration only | Not here yet (future `integrations/` if needed) |

After you add a package: add it to the CI `pkg.pr.new` list, the Pages assemble loop, `pages/index.html`, and the table above.

## Known gap

`comark-kv` model tests and typecheck import `comark/model`. That export is not in `comark@0.7.0`. Parse-time kv tests pass. The model layer waits on a newer `comark`.
