import { parseMarkdown } from 'comark'
import arrow from '../src/index.ts'

const content = `---
title: Arrow playground
---

# Arrow

\`\`\`arrow
const state = reactive({ count: 0 })
export default html\`<button @click="\${() => state.count++}">\${() => state.count}</button>\`
\`\`\`
`

const tree = await parseMarkdown(content, { plugins: [arrow()] })

console.log('frontmatter:', tree.frontmatter)
console.log('meta:', tree.meta)
console.log(
  'nodes:',
  tree.nodes.map((n) => (Array.isArray(n) ? [n[0], Object.keys(n[1] ?? {})] : typeof n)),
)
