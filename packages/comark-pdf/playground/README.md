# Comark — PDF Plugin Playground

Nuxt site for `comark-pdf`.

- `/` — repository README, rendered with Comark
- `/play` — editable Markdown playground

`/play` has three examples:

- **Markdown** — full mapper tour (text, lists, task marks, tables, rangi, math, mermaid, embed images, SVG, bindings, custom `::alert`, page chrome)
- **Invoice** — multi-page table + key-value blocks
- **Product label** — custom page size + `::barcode` component

## Running

From the repository root:

```bash
pnpm play:nuxt
```

## Open Graph image

`og/generate.mjs` reads `comark` fields from the root `package.json` and writes
`public/og.png` (also the README cover).

```bash
pnpm og:generate
```
