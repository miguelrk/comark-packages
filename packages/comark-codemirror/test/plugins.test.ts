import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { comark, configOf, definePlugin, resolveConfig, resolvePlugins } from '../src/index.ts'
import { presetBuiltins } from '../src/presets/builtins.ts'
import { presetEcosystem } from '../src/presets/ecosystem.ts'

describe('plugins', () => {
  it('registers comark defaults unless disabled', () => {
    expect(resolveConfig().plugins.map(p => p.name)).toEqual(['alert', 'attributes', 'components', 'frontmatter', 'html', 'task-list'])
    expect(resolveConfig({ registerDefaultPlugins: false }).plugins).toEqual([])
  })

  it('dedupes by name (later wins) and orders by enforce', () => {
    const a = definePlugin(() => ({ name: 'x', llms: 'first' }))
    const b = definePlugin(() => ({ name: 'x', llms: 'second' }))
    const pre = definePlugin(() => ({ name: 'pre', enforce: 'pre' }))
    expect(resolvePlugins([a(), pre(), b()]).map(p => [p.name, p.llms])).toEqual([['pre', undefined], ['x', 'second']])
  })

  it('merges manifests: plugins first, options last', () => {
    const config = resolveConfig({ plugins: presetEcosystem(), components: [{ name: 'qrcode', kind: 'block', description: 'Mine', props: { extra: {} } }] })
    const qr = config.components.get('qrcode')!
    expect(qr.description).toBe('Mine')
    expect(Object.keys(qr.props!)).toEqual(expect.arrayContaining(['value', 'extra']))
  })

  it('exposes the config through the state', () => {
    const state = EditorState.create({ extensions: comark({ plugins: presetBuiltins() }) })
    expect(configOf(state).plugins.length).toBe(21)
    expect(configOf(EditorState.create({})).plugins.length).toBe(6)
  })

  it('every plugin documents its syntax for agents', () => {
    for (const plugin of [...resolveConfig().plugins, ...presetBuiltins(), ...presetEcosystem()]) expect(plugin.llms, plugin.name).toBeTruthy()
  })
})
