/**
 * Mermaid: ```` ```mermaid ```` fences. Completes the diagram type on the
 * first line and common keywords after it; diagram snippets in the block menu.
 */
import type { Item } from '../types.ts'
import { definePlugin } from '../plugins.ts'

const DIAGRAMS = [
  ['flowchart TD', 'flowchart', 'flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]\n  B -->|No| A'],
  ['sequenceDiagram', 'sequence', 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi'],
  ['classDiagram', 'class', 'classDiagram\n  class Animal {\n    +name: string\n  }'],
  ['stateDiagram-v2', 'state', 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy'],
  ['erDiagram', 'entity relationship', 'erDiagram\n  USER ||--o{ POST : writes'],
  ['gantt', 'gantt', 'gantt\n  title Plan\n  section A\n  Task :a1, 2024-01-01, 3d'],
  ['pie', 'pie', 'pie title Share\n  "A" : 40\n  "B" : 60'],
  ['mindmap', 'mind map', 'mindmap\n  root((Topic))\n    Idea'],
] as const

const KEYWORDS = ['subgraph', 'end', 'participant', 'actor', 'note', 'loop', 'alt', 'else', 'opt', 'classDef', 'class', 'style', 'click', 'direction', 'title', 'section']

export default definePlugin(() => ({
  name: 'mermaid',
  fences: ['mermaid'],
  completions: [{
    kinds: ['fence-body'],
    provide({ context, index }) {
      if (context.kind !== 'fence-body' || context.lang !== 'mermaid') return null
      const fence = index.regionAt(context.line)?.node
      if (fence && context.line === fence.line + 1) return DIAGRAMS.map(([label, detail]): Item => ({ label, detail, type: 'keyword' }))
      return KEYWORDS.map((k): Item => ({ label: k, type: 'keyword' }))
    },
  }],
  snippets: DIAGRAMS.map(([, name, body]) => ({ label: `Mermaid ${name}`, insert: `\`\`\`mermaid\n${body}$0\n\`\`\``, detail: '```mermaid', section: 'Diagrams', type: 'fence' })),
  llms: 'Mermaid diagrams: a ```` ```mermaid ```` fence (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, …).',
}))
