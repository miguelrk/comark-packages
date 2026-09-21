const PNG_DOT = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_URI = `data:image/png;base64,${PNG_DOT}`

export const markdownSample = `---
title: Comark PDF Demo
author: Playground
pdf:
  format: A4
  margin: 20mm
  fontSize: 11
  color: "#1b2433"
  lineHeight: 1.45
  header: Comark PDF
  headerRight: Playground
  footer: "Page {{ page }} of {{ totalPages }}"
  footerLeft: comark-pdf
  footerRight: jasy
  onOverflow: warn
---

# Comark PDF Renderer

Render **Comark** markdown as _paginated_ print-ready pages using [jasy](https://jasy.dev). This file is the full mapper tour.

## Text

You can use **bold**, _italic_, ***both***, ~~strikethrough~~, and \`inline code\`.

Links look like this: [comark.dev](https://comark.dev). Super and sub use HTML: E = mc<sup>2</sup>, H<sub>2</sub>O.

## Headings (PDF outline)

Each heading below is a PDF bookmark and an internal anchor.

### Section heading

#### Sub heading

##### Detail heading

###### Fine heading

## Lists

Unordered:

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

Ordered:

1. Step one
2. Step two
   1. Nested step
3. Step three

Task list (printed marks, not form fields):

- [x] Write the docs
- [ ] Fix the remaining gaps
- [x] Ship a first PDF
  - [ ] Nested pending item

## Blockquote

> The page is not just a container,
> it is a unit of reading.

::page-break
::

## Code

Fenced blocks keep highlighter token colors when \`rangi()\` (or Shiki) is in \`plugins\`.

\`\`\`typescript
import { createPdfRenderer } from 'comark-pdf'

const renderPdf = createPdfRenderer()
const bytes = await renderPdf('# Hello World')
\`\`\`

## Tables

| Feature | Status |
| --- | --- |
| Headings + outline | mapped |
| Task-list marks | mapped |
| Highlighted code | mapped |
| Page chrome | mapped |

Key-value (empty header, two columns — \`visuals.table.keyValue\`):

| | |
| --- | ---: |
| Renderer | comark-pdf |
| Engine | jasy |
| Input | Comark AST |

---

::page-break
::

## Math

Needs optional peer \`mathjax-full\`. Missing peer keeps Courier source.

Inline: $E = mc^2$

Display:

$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

::page-break
::

## Mermaid

Needs optional peer \`mermaid\`. Missing peer or DOM keeps a source box.

\`\`\`mermaid
flowchart LR
  md[Comark AST] --> map[comark-pdf]
  map --> draw[jasy]
\`\`\`

::page-break
::

## Images

\`visuals.image: embed\` resolves a data URI, a local path, or HTTP(S). Failure stays alt-text. An inline image splits the paragraph into a column.

Block:

![Comark mark](${PNG_URI}){width="36" height="36"}

Inline: before ![dot](${PNG_URI}){width="12" height="12"} after.

Default (no embed) would print \`[Image: …]\`.

## SVG

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32" width="120" height="32"><rect width="120" height="32" rx="4" fill="#1450aa"/><circle cx="16" cy="16" r="6" fill="#f0db4f"/></svg>

## Bindings

Hello {{ data.name }}.

::if{:value="data.showTerms"}
Terms are **on**. This branch is visible.
#else
Terms are off.
::

::for{:each="data.items" item="item"}
- {{ props.item.label }}
::

::include{:value="data.snippet"}
::

## Custom component

::alert
This box is a host \`JasyComponentFn\` (\`alert\`). Markdown inside the slot still maps.
::

---

_Edit the markdown on the left to see live paginated updates._
`
