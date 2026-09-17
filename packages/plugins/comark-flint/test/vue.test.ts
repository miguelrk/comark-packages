import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import flintPlugin from '../src/index.ts'
import flint, { Flint, assembleSpec, parseFenceMeta } from '../src/vue/index.ts'

describe('vue exports', () => {
  it('re-exports the plugin factory as default', () => {
    expect(flint).toBe(flintPlugin)
    expect(typeof flint()).toBe('object')
    expect(flint().name).toBe('flint')
  })

  it('exports Flint as a named Vue component', () => {
    expect(Flint).toBeDefined()
    expect(Flint.name ?? (Flint as { __name?: string }).__name).toBe('Flint')
  })

  it('re-exports plugin utilities', () => {
    expect(typeof assembleSpec).toBe('function')
    expect(typeof parseFenceMeta).toBe('function')
  })
})

describe('Flint render contract', () => {
  it('shows a soft-fail error UI when spec is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(Flint, { props: { backend: 'vegalite' } })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Missing chart spec')
    expect(wrapper.find('.flint-error').exists()).toBe(true)
    warnSpy.mockRestore()
  })

  it('soft-fails for unsupported backends without throwing', async () => {
    const wrapper = mount(Flint, {
      props: {
        spec: { type: 'bar' },
        backend: 'chartjs',
      },
    })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('chartjs')
  })

  it('accepts documented attrs (spec, backend, width, height, theme, input)', () => {
    const wrapper = mount(Flint, {
      props: {
        spec: { mark: 'bar' },
        backend: 'vegalite',
        width: 560,
        height: 320,
        theme: 'economist',
        input: { chart_spec: { chartType: 'Bar Chart' } },
      },
    })
    expect(wrapper.props()).toMatchObject({
      backend: 'vegalite',
      width: 560,
      height: 320,
      theme: 'economist',
    })
    expect(wrapper.props('spec')).toEqual({ mark: 'bar' })
  })
})
