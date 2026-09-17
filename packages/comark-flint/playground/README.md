# Comark — Flint Plugin Playground

Nuxt site for `comark-flint`.

- `/` — repository README, rendered with Comark
- `/play` — editable Markdown with Flint fenced blocks and directives

## Running

From the repository root:

```bash
pnpm play:nuxt
```

## Open Graph image

`og/generate.mjs` reads `comark` fields from the root `package.json`, embeds a
live Flint→Vega-Lite SVG, and writes `public/og.png` (also the README cover).

```bash
pnpm og:generate
```
