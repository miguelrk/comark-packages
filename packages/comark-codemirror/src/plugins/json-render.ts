/**
 * JSON Render: ```` ```json-render ```` / ```` ```yaml-render ```` fences
 * with a UI spec. Validates the JSON and the spec shape.
 */
import type { Diagnostic } from '@codemirror/lint'
import { definePlugin } from '../plugins.ts'

export default definePlugin(() => ({
  name: 'json-render',
  fences: ['json-render', 'yaml-render'],
  snippets: [{ label: 'JSON render', insert: '```json-render\n{\n  "root": "main",\n  "elements": {\n    "main": { "type": "${1:Card}", "props": {$0} }\n  }\n}\n```', detail: '```json-render', section: 'Data', type: 'fence' }],
  lint: [({ state, index }) => {
    const out: Diagnostic[] = []
    for (const node of index.outline) {
      if (node.kind !== 'fence' || node.name !== 'json-render' || !node.closed || node.endLine - node.line < 2) continue
      const from = state.doc.line(node.line + 1).from
      const to = state.doc.line(node.endLine - 1).to
      try {
        const spec = JSON.parse(state.sliceDoc(from, to)) as unknown
        if (!spec || typeof spec !== 'object' || !('root' in spec) || !('elements' in spec)) out.push({ from, to: state.doc.line(node.line + 1).to, severity: 'warning', source: 'json-render', message: 'A json-render spec needs `root` and `elements`.' })
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const at = /position (\d+)/.exec(message)
        const pos = at ? Math.min(to, from + Number(at[1])) : from
        out.push({ from: pos, to: Math.min(to, pos + 1), severity: 'error', source: 'json-render', message: `Invalid JSON: ${message}` })
      }
    }
    return out
  }],
  llms: 'JSON Render: a ```` ```json-render ```` (or `yaml-render`) fence with `{ "root": "id", "elements": { "id": { "type", "props", "children" } } }` renders a UI tree.',
}))
