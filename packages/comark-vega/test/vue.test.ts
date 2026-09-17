import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { parseMarkdown } from 'comark'
import vegaPlugin, { Vega, mountVegaView } from '../src/vue/index.ts'
import type { VegaNodeAttrs } from '../src/vue/index.ts'

const barSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  mark: 'bar',
  data: { values: [{ x: 'A', y: 4 }, { x: 'B', y: 6 }] },
  encoding: {
    x: { field: 'x', type: 'nominal' },
    y: { field: 'y', type: 'quantitative' },
  },
}

describe('comark-vega/vue exports', () => {
  it('exports the plugin factory as default and Vega as a named export', () => {
    expect(typeof vegaPlugin).toBe('function')
    expect(Vega).toBeDefined()
    expect(typeof Vega).toBe('object')
  })

  it('exports mountVegaView for non-Vue renderers', () => {
    expect(typeof mountVegaView).toBe('function')
  })
})

describe('mountVegaView contract', () => {
  it('renders an SVG into the container', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const mounted = await mountVegaView(el, { spec: barSpec, engine: 'vega-lite' })
    expect(el.querySelector('svg')).toBeTruthy()
    expect(() => mounted.finalize()).not.toThrow()
    el.remove()
  })

  it('rejects invalid specs without leaving a partial view', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    await expect(
      mountVegaView(el, {
        spec: { $schema: 'https://vega.github.io/schema/vega-lite/v6.json', mark: { type: 'not-a-mark' } },
        engine: 'vega-lite',
      }),
    ).rejects.toBeTruthy()
    expect(el.querySelector('svg')).toBeNull()
    el.remove()
  })
})

describe('Vega Vue renderer contract', () => {
  it('mounts a chart from a literal spec prop', async () => {
    const wrapper = mount(Vega, {
      props: {
        spec: barSpec,
        engine: 'vega-lite',
      } satisfies VegaNodeAttrs,
      attachTo: document.body,
    })

    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.element.querySelector('.vega-chart svg')).toBeTruthy()
    })

    wrapper.unmount()
  })

  it('soft-fails with a visible error UI instead of throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(Vega, {
      props: {
        spec: {
          $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
          mark: { type: 'not-a-mark' },
        },
        engine: 'vega-lite',
      },
      attachTo: document.body,
    })

    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('pre.vega-error').exists()).toBe(true)
    })
    expect(wrapper.find('pre.vega-error code').text().length).toBeGreaterThan(0)

    wrapper.unmount()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('tears down cleanly on unmount', async () => {
    const wrapper = mount(Vega, {
      props: { spec: barSpec, engine: 'vega-lite' },
      attachTo: document.body,
    })

    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.element.querySelector('.vega-chart svg')).toBeTruthy()
    })

    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('plugin + Vega node round-trip', () => {
  it('fenced vega-lite block attrs match Vega component props', async () => {
    const md = `\`\`\`vega-lite\n${JSON.stringify(barSpec)}\n\`\`\``
    const { nodes } = await parseMarkdown(md, { plugins: [vegaPlugin()] })
    const node = nodes.find((n) => Array.isArray(n) && n[0] === 'Vega') as
      | ['Vega', VegaNodeAttrs]
      | undefined

    expect(node).toBeDefined()
    expect(node![1].spec).toMatchObject({ mark: 'bar' })
    expect(node![1].engine).toBe('vega-lite')
  })
})
