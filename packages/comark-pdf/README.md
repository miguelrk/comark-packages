# comark-pdf

PDF renderer for [Comark](https://comark.dev). Convert Markdown to print-ready PDF bytes via [jasy](https://jasy.dev) — no headless browser required.

![npm version](https://img.shields.io/npm/v/comark-pdf?style=flat&colorA=18181B&colorB=F0DB4F) ![npm downloads](https://img.shields.io/npm/dm/comark-pdf?style=flat&colorA=18181B&colorB=F0DB4F) ![CI](https://img.shields.io/github/actions/workflow/status/miguelrk/comark-packages/ci.yml?branch=main&style=flat&colorA=18181B&colorB=F0DB4F) ![license](https://img.shields.io/github/license/miguelrk/comark-packages?style=flat&colorA=18181B&colorB=F0DB4F)

![comark-pdf — PDF renderer for Comark](playground/public/og.png)

## Install

```bash
pnpm add comark-pdf
```

`comark` is a peer dependency.

## Usage

### Render to PDF bytes

```ts
import { renderPdf, createPdfRenderer } from 'comark-pdf'
import { writeFile } from 'node:fs/promises'

// One-shot
const bytes = await renderPdf(`
---
pdf:
  format: A4
  margin: 20mm
  footer: "Page {{ page }} of {{ totalPages }}"
---

# My Document

Content here.

::page-break
::

# Chapter 2

More content.
`)

await writeFile('output.pdf', bytes)

// Reusable renderer (parser initialized once)
const render = createPdfRenderer({
  pdf: { format: 'A4', margin: '20mm', footer: 'Page {{ page }} of {{ totalPages }}' },
})
const bytes2 = await render(markdownString)
```

### Node.js file export

```ts
import { renderPdfToBuffer, renderPdfToFile } from 'comark-pdf/node'

const buffer = await renderPdfToBuffer(markdown)
await writeFile('output.pdf', buffer)

// Or write directly to a file
await renderPdfToFile(markdown, 'output.pdf')
```

### Browser preview

```ts
import { renderPdf } from 'comark-pdf'
import { mount } from 'comark-pdf/preview'

const bytes = await renderPdf(markdownString)
const handle = mount(document.getElementById('preview'), bytes)

// Later, to free the Blob URL:
handle.revoke()
```

## Locale files

The library does not own template files. Hosts pick one markdown file per locale (`en/`, `es/`). Bind only the locale key that the file owns: `{{ data.sheet.tradeName.en }}` in the English file, `{{ data.sheet.tradeName.es }}` in the Spanish file. Do not write `||` locale fallbacks. A missing value renders empty.

Do not use `::kv`. Write labels in the locale file (GFM tables, `::if`, `::for`). Use `::include` only for a stored markdown string. Do not use `[meta.locale]`.

## Options

`renderPdf()`, `createPdfRenderer()`, and the Node helpers accept `PdfRendererOptions`:

| Option | Type | Description |
| --- | --- | --- |
| `pdf` | `PdfPageConfig` | Page size, margins, typography, metadata. String `header` / `footer` compile into chrome. |
| `chrome` | `PdfChrome` | Page header, footer, and watermark elements. Replaces compiled string templates. |
| `visuals` | `PdfVisuals` | Print faces and table / quote / image map |
| `plugins` | `ComarkPlugin[]` | Parser plugins (math, mermaid, binding, …) |
| `components` | `Record<string, JasyComponentFn>` | Custom jasy component factories by tag name |
| `fonts` | `Record<string, Uint8Array \| FontFaces>` | Font paths or bytes; registered with `addFont` |

Also accepts Comark `ParserOptions` (`autoClose`, `linkify`, `registerDefaultPlugins`, …).

Merge order for page config (last write wins): `frontmatter.pdf` → `options.pdf`.

### `pdf` / frontmatter

Set defaults in code via `options.pdf`, or per document under a `pdf:` frontmatter block (same keys):

```yaml
---
pdf:
  format: A4          # page size (A4, Letter, A3, A5, …); ignored when width + height are set
  width: 50mm         # custom page width (pair with height)
  height: 65mm        # custom page height (pair with width)
  orientation: portrait  # portrait | landscape
  margin: 20mm        # length string, points number, or { top, right, bottom, left }
  gap: 10             # space between block children (points)
  justify: start      # page main-axis alignment
  align: start        # page cross-axis alignment
  font: Helvetica     # document default font
  fontSize: 11        # document default text size (points)
  color: "#1b2433"    # document default text color
  lineHeight: 1.5     # document default line-height
  textAlign: left     # document default text align
  title: "My Report"  # PDF metadata + accessibility title
  author: "Acme"
  lang: en-US
  accessible: false
  onOverflow: error   # error | warn | ignore
  header: "My Report" # compiles to chrome.header; tokens: {{ page }}, {{ totalPages }}
  headerLeft: "Draft"
  headerRight: "Confidential"
  footer: "Page {{ page }} of {{ totalPages }}"
  footerLeft: "Company Name"
  footerRight: "2026"
---
```

`margin` is the paper inset only. Header and footer sit inside that box and take their own height. Do not add chrome height into `margin`. Pass `chrome.header` / `chrome.footer` to replace the compiled strings. Pass `chrome.watermark` as a `Positioned` overlay; it is not part of the header band.

Length values accept `mm`, `cm`, `in`, `pt`, `px`, or a bare number (treated as points).

```ts
const bytes = await renderPdf(markdown, {
  pdf: {
    format: 'Letter',
    margin: '25mm',
    footer: 'Page {{ page }} of {{ totalPages }}',
  },
})
```

## Feature support

**Supported:** headings, paragraphs, bold / italic / strikethrough, links, lists, blockquotes, rules, tables, page size and margins, headers / footers with `{{ page }}` / `{{ totalPages }}` tokens, `::page-break`, multi-page flow, browser `mount`, Node file export.

**Degraded (source kept, no rich visual):**

| Feature | PDF output | Reason |
| ------- | ---------- | ------ |
| Code blocks (Shiki / rangi) | Monospace text in a tinted box | Highlighters emit HTML |
| Math (KaTeX) | LaTeX source as monospace text | KaTeX emits HTML |
| Mermaid | Diagram source as monospace block | Mermaid emits SVG |
| Images | Alt-text placeholder | Remote URL fetch not wired |

**Not yet:** raw HTML blocks as layout, full footnote chrome, checkbox glyphs.

## Plugins

```ts
import { renderPdf } from 'comark-pdf'
import math, { Math } from 'comark-pdf/plugins/math'
import mermaid, { Mermaid } from 'comark-pdf/plugins/mermaid'

const bytes = await renderPdf(markdown, {
  plugins: [math(), mermaid()],
  components: { Math, Mermaid },
})
```

## Custom components

Override any Comark component tag with a jasy element factory:

```ts
import { renderPdf } from 'comark-pdf'
import { Box, Text } from '@jasy/pdf'

const bytes = await renderPdf(markdown, {
  components: {
    alert: ([, attrs, ...children], ctx) =>
      Box({ bg: '#fff3cd', padding: 12, radius: 4 }, ctx.mapNodes(children)),
  },
})
```

## Development

```bash
pnpm install
pnpm test
pnpm play
pnpm play:nuxt
pnpm build
```

## License

[MIT](./LICENSE)
