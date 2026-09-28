---
timeout:
  parse: 500ms
  html: 5ms
  markdown: 5ms
options:
  highlight:
    themes:
      light: 'github-dark'
    preStyles: true
---

## Input

```md
<!-- Single line comment -->

<!--

Multi line Comment

-->
```

## AST

```json
{
  "frontmatter": {},
  "meta": {},
  "nodes": [
    [
      null,
      {},
      " Single line comment "
    ],
    [
      null,
      {},
      "\n\nMulti line Comment\n\n"
    ]
  ]
}
```

## HTML

```html
<!-- Single line comment -->
<!--

Multi line Comment

-->
```

## Markdown

```md
<!-- Single line comment -->

<!--

Multi line Comment

-->
```
