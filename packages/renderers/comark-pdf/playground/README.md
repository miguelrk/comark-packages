# Comark — PDF Plugin Playground

Nuxt site for `comark-pdf`.

- `/` — repository README, rendered with Comark
- `/play` — editable Markdown playground

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
