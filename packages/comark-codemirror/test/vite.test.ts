import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { comarkCodemirrorComponents, extractComponent, scanComponents, VIRTUAL_ID } from '../src/vite.ts'

describe('component manifest extraction', () => {
  it('reads Vue type-based props, defaults and slots', () => {
    const def = extractComponent('ProseCard.vue', `<!-- A content card -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Card title */
  title: string
  variant?: 'soft' | 'outline'
  items?: string[]
  count?: number
  open?: boolean
}>(), { variant: 'soft' })
</script>
<template>
  <div><slot /><footer><slot name="footer" /></footer></div>
</template>`)
    expect(def).toEqual({
      name: 'prose-card',
      kind: 'both',
      description: 'A content card',
      props: {
        title: { type: 'string', required: true, description: 'Card title' },
        variant: { type: 'string', enum: ['soft', 'outline'], required: false, default: 'soft' },
        items: { type: 'array', required: false },
        count: { type: 'number', required: false },
        open: { type: 'boolean', required: false },
      },
      slots: [{ name: 'default' }, { name: 'footer' }],
    })
  })

  it('reads interface-based and runtime props', () => {
    expect(extractComponent('Alert.vue', `<script setup lang="ts">
interface Props { type: 'info' | 'warning' }
defineProps<Props>()
</script>`).props).toEqual({ type: { type: 'string', enum: ['info', 'warning'], required: true } })
    expect(extractComponent('Badge.vue', `<script setup>
defineProps({ color: String, size: { type: Number, required: true, default: '2' } })
</script>`).props).toEqual({ color: { type: 'string', required: false }, size: { type: 'number', required: true, default: '2' } })
  })

  it('reads React props interfaces', () => {
    expect(extractComponent('Callout.tsx', `interface CalloutProps { tone?: 'info' | 'danger'; children?: React.ReactNode }
export function Callout(props: CalloutProps) { return null }`)).toEqual({
      name: 'callout',
      kind: 'both',
      props: { tone: { type: 'string', enum: ['info', 'danger'], required: false } },
      slots: [{ name: 'default' }],
    })
  })

  it('scans directories and serves the virtual module', () => {
    const root = mkdtempSync(join(tmpdir(), 'cme-'))
    mkdirSync(join(root, 'components/content/nested'), { recursive: true })
    writeFileSync(join(root, 'components/content/Hero.vue'), '<script setup lang="ts">defineProps<{ title: string }>()</script>')
    writeFileSync(join(root, 'components/content/nested/Quote.vue'), '<template><slot /></template>')
    const manifest = scanComponents(root, { manifest: [{ name: 'hero', kind: 'block', description: 'Hero section' }] })
    expect(manifest.map(c => c.name)).toEqual(['hero', 'nested-quote'])
    expect(manifest[0]).toMatchObject({ kind: 'block', description: 'Hero section', props: { title: { type: 'string' } } })
    const plugin = comarkCodemirrorComponents()
    plugin.configResolved!({ root })
    const id = plugin.resolveId!(VIRTUAL_ID)!
    expect(plugin.load!(id)).toContain('"nested-quote"')
  })
})
