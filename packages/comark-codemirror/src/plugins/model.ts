/**
 * Model: two-way binding with `::prop="path"` attributes. Only writable
 * roots (`data` by default) are completed; others are reported by lint.
 */
import { definePlugin } from '../plugins.ts'

export default definePlugin(() => ({
  name: 'model',
  llms: 'Two-way binding: `::value="data.name"` on inputs and components writes back to `data`. Example: `:input{::value="data.email" type="email"}`.',
}))
