/**
 * Summary: `<!-- more -->` separates the excerpt (`meta.summary`) from the rest.
 */
import { definePlugin } from '../plugins.ts'

export default definePlugin<{ delimiter?: string }>((options = {}) => {
  const delimiter = options.delimiter ?? 'more'
  return {
    name: 'summary',
    snippets: [{ label: 'Summary break', insert: `<!-- ${delimiter} -->\n$0`, detail: `<!-- ${delimiter} -->`, section: 'Document', type: 'divider' }],
    scopes: [({ state }) => {
      const text = state.doc.toString()
      const at = text.search(new RegExp(`^\\s*<!--\\s*${delimiter}\\s*-->`, 'm'))
      return at < 0 ? null : { name: 'meta', shape: { type: 'object', properties: { summary: { type: 'array', description: 'Nodes before the summary break' } } } }
    }],
    llms: `Summary: content before a \`<!-- ${delimiter} -->\` line is the excerpt (\`meta.summary\`).`,
  }
})
