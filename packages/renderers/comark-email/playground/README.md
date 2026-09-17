# comark-email playground

Nuxt development environment for `comark-email`.

## Setup

```bash
pnpm install
```

## Development

```bash
# From repo root:
pnpm play:nuxt

# Or from this directory:
pnpm dev
```

Open [http://localhost:3000/play](http://localhost:3000/play) to edit Markdown and see the compiled email HTML in an iframe. Subject and preview text are shown above the preview. MJML errors appear in a red banner.

## CLI preview

```bash
# From repo root:
pnpm play
```

Renders `ADVANCED_EMAIL_MARKDOWN` and prints `subject`, `previewText`, `errors`, and `html length`.

## OG image

```bash
pnpm og:generate
```

Regenerates `public/og.png` (1200×630) used as the site Open Graph image.
