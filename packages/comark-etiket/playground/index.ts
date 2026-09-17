import { parseMarkdown } from 'comark'
import etiket from '../src/index.ts'

const content = `---
title: Etiket playground
etiket:
  ecLevel: H
---

# Etiket

::qrcode{value="https://comark.dev" dot-type="dots"}
::

::barcode{value="4006381333931" type="ean13" show-text="true"}
::

::qr-wifi{ssid="GuestNetwork" password="Welcome123"}
::
`

const tree = await parseMarkdown(content, { plugins: [etiket()] })

console.log('frontmatter:', tree.frontmatter)
console.log(
  'nodes:',
  tree.nodes.map((n) => (Array.isArray(n) ? [n[0], Object.keys(n[1] ?? {})] : typeof n)),
)
