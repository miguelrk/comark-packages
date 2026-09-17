# Comark — Vega Plugin Playground

Nuxt site for `comark-vega`.

- `/` — repository README, rendered with Comark
- `/play` — chart playground (`@comark/nuxt` + shipped `Vega` component)

## Running

From the repository root:

```bash
pnpm play:nuxt
```

## Open Graph image

`og/generate.mjs` reads `comark` fields from the root `package.json`, embeds a
live Vega-Lite SVG, and writes `public/og.png` (also the README cover).

```bash
pnpm og:generate
```
