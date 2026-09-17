import { renderPdfToFile } from '../src/node.ts'

const content = `---
pdf:
  format: A4
  margin: 20mm
  footer: "Page {{ page }} of {{ totalPages }}"
---

# Hello from comark-pdf

Some **bold** and _italic_ text.

## Section

- Item one
- Item two
- Item three

::page-break
::

## Second page

More content on a new page.
`

const outPath = new URL('./output.pdf', import.meta.url).pathname
await renderPdfToFile(content, outPath)
console.log('PDF written to', outPath)
