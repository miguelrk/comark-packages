# Comark — Fetch Plugin Playground

Nuxt site for `comark-fetch`.

- `/` — repository README, rendered with Comark
- `/play` — editable Markdown with `fetch:` frontmatter + binding

`fetch:` entries resolve **at parse time** into `meta.fetch`.

## Running

From the repository root:

```bash
pnpm play:nuxt
```

The playground allows `https://jsonplaceholder.typicode.com` via `allowOrigins`.

## Open Graph image

```bash
pnpm og:generate
```
