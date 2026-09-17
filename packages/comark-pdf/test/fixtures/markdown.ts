export const BASIC_MARKDOWN = `---
pdf:
  format: A4
  margin: 20mm
  footer: "Page {{ page }} of {{ totalPages }}"
---

# Basic Document

Some **bold** and _italic_ text with a [link](https://example.com).

## Section 1

A paragraph with \`inline code\` and a list:

- Item one
- Item two
  - Nested item
- Item three

## Section 2

An ordered list:

1. First
2. Second
3. Third

### Blockquote

> This is a blockquote with some text.

### Code block

\`\`\`js
const x = 1 + 2
console.log(x)
\`\`\`

### Table

| Name | Value |
| ---- | ----- |
| Foo  | 42    |
| Bar  | 99    |

::page-break
::

## Second Page

Content on the second page.

---

A horizontal rule above.
`

export const ADVANCED_MARKDOWN = `---
pdf:
  format: A4
  margin: 20mm
  header: "My Report"
  headerRight: "Draft"
  footer: "Page {{ page }} of {{ totalPages }}"
  footerLeft: "Company"
  footerRight: "2026"
  title: Advanced Report
  author: Test Suite
  lang: en-US
  font: Helvetica
  fontSize: 11
  color: "#1b2433"
  lineHeight: 1.5
---

# Advanced Document

Inline ~~strikethrough~~ text.

## Math placeholder

$E = mc^2$

## Mermaid placeholder

\`\`\`mermaid
graph TD; A-->B;
\`\`\`

## Image fallback

![An example image](https://example.com/image.png)
`
