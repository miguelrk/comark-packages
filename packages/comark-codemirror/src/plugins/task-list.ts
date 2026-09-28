/**
 * Task lists (default): `- [ ]` and `- [x]`.
 */
import { definePlugin } from '../plugins.ts'

export default definePlugin(() => ({
  name: 'task-list',
  completions: [{
    kinds: ['task'],
    provide: () => [
      { label: '[ ]', insert: '[ ] $0', detail: 'open task', glyph: '☐', type: 'task' },
      { label: '[x]', insert: '[x] $0', detail: 'done', glyph: '☑', type: 'task' },
    ],
  }],
  snippets: [{ label: 'Task list', insert: '- [ ] $0', detail: '- [ ]', section: 'Lists', type: 'task' }],
  llms: 'Task lists: `- [ ] open` and `- [x] done`.',
}))
