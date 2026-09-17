# Comark — Arrow Plugin Playground

Nuxt site for `comark-arrow`.

- `/` — repository README, rendered with Comark
- `/play` — editable Markdown playground with live Arrow sandboxes

## Running

From the repository root:

```bash
pnpm play:nuxt
```

## Open Graph image

`og/generate.mjs` reads `comark` fields from the root `package.json` and writes
`public/og.png` (also the README cover). Does not boot the WASM sandbox.

```bash
pnpm og:generate
```
