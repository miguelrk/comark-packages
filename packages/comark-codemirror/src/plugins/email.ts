/**
 * comark-email: email-safe layout components.
 */
import type { ComponentDef, PropDef } from '../types.ts'
import { definePlugin } from '../plugins.ts'

const button: Record<string, PropDef> = {
  'href': { type: 'string', required: true },
  'background-color': { type: 'string' },
  'color': { type: 'string' },
  'align': { enum: ['left', 'center', 'right'] },
  'border-radius': { type: 'string' },
  'font-size': { type: 'string' },
  'width': { type: 'string' },
  'target': { type: 'string' },
  'padding': { type: 'string' },
}

export const emailComponents: ComponentDef[] = [
  { name: 'email-button', kind: 'block', group: 'Email', description: 'Call-to-action button', props: button, example: '::email-button{href="https://comark.dev"}\nGet started\n::' },
  { name: 'email-divider', kind: 'block', group: 'Email', description: 'Horizontal divider', props: { 'border-color': { type: 'string' }, 'border-width': { type: 'string' }, 'padding': { type: 'string' } } },
  { name: 'email-columns', kind: 'block', group: 'Email', description: 'Column layout', props: { 'background-color': { type: 'string' }, 'padding': { type: 'string' } } },
]

export default definePlugin(() => ({
  name: 'email',
  components: emailComponents,
  llms: 'Email components (comark-email): `::email-button{href="…"}`, `::email-divider`, `::email-columns`.',
}))
