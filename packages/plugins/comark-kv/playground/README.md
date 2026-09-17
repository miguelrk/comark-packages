# Comark — KV Plugin Playground

Nuxt site for `comark-kv`.

- `/` — repository README, rendered with Comark
- `/play` — **Todo desk** demo: one document with three drivers
  - `config` → **browser** (localStorage) — user name + dark/light mode
  - `draft` → **memory** — new-todo form (`todo`, `completed`) POSTed on submit
  - `todos` → **http** shortcut — remote checklist from JSONPlaceholder

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
