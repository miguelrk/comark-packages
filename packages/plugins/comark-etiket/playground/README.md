# Comark — Etiket Plugin Playground

Nuxt site for `comark-etiket`.

- `/` — repository README, rendered with Comark
- `/play` — editable Markdown with barcode and QR directives

Barcodes and QR codes are generated **at parse time** — no per-framework render component is required.

## Running

From the repository root:

```bash
pnpm play:nuxt
```

## Open Graph image

`og/generate.mjs` reads `comark` fields from the root `package.json`, embeds live
etiket SVGs (QR · dots, EAN-13, Code 128), and writes `public/og.png` (also the
README cover).

```bash
pnpm og:generate
```
