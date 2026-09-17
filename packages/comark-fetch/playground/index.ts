import { parseMarkdown } from 'comark'
import fetchPlugin from '../src/index.ts'

const content = `---
title: Fetch playground
fetch:
  posts: https://jsonplaceholder.typicode.com/posts?_limit=2
---

# Fetch

Posts land in meta.fetch after parse.
`

const tree = await parseMarkdown(content, {
  plugins: [
    fetchPlugin({
      allowOrigins: ['https://jsonplaceholder.typicode.com'],
    }),
  ],
})

console.log('frontmatter:', tree.frontmatter)
console.log('meta.fetch:', tree.meta.fetch)
console.log('meta.fetchErrors:', tree.meta.fetchErrors)
