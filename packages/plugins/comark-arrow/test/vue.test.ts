import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import {
  ArrowSandbox,
  provideArrowHostBridge,
} from '../src/vue/ArrowSandbox.ts'

vi.mock('@arrow-js/sandbox', () => ({
  sandbox: vi.fn(() => {
    const mountFn = (el: HTMLElement) => {
      el.textContent = 'mounted'
    }
    return mountFn
  }),
}))

describe('ArrowSandbox vue', () => {
  it('does not import sandbox when status is pending', async () => {
    const sandboxMod = await import('@arrow-js/sandbox')
    vi.mocked(sandboxMod.sandbox).mockClear()

    mount(ArrowSandbox, {
      props: {
        source: 'export default html`<div/>`',
        status: 'pending',
      },
    })
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(sandboxMod.sandbox).not.toHaveBeenCalled()
  })

  it('boots sandbox when status is ready', async () => {
    const sandboxMod = await import('@arrow-js/sandbox')
    vi.mocked(sandboxMod.sandbox).mockClear()

    const wrapper = mount(ArrowSandbox, {
      props: {
        source: 'export default html`<div/>`',
        status: 'ready',
      },
    })
    await nextTick()
    await new Promise((r) => setTimeout(r, 50))

    expect(sandboxMod.sandbox).toHaveBeenCalled()
    expect(wrapper.find('.arrow-sandbox-host').text()).toBe('mounted')
  })

  it('surfaces onError without throwing', async () => {
    const sandboxMod = await import('@arrow-js/sandbox')
    vi.mocked(sandboxMod.sandbox).mockImplementationOnce((props) => {
      return (() => {
        props.onError?.(new Error('boom'))
      }) as unknown as ReturnType<typeof sandboxMod.sandbox>
    })

    const wrapper = mount(ArrowSandbox, {
      props: {
        source: 'export default html`<div/>`',
        status: 'ready',
      },
    })
    await nextTick()
    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.find('.arrow-sandbox-error').text()).toContain('boom')
  })

  it('receives hostBridge from provideArrowHostBridge', async () => {
    const sandboxMod = await import('@arrow-js/sandbox')
    vi.mocked(sandboxMod.sandbox).mockClear()

    const bridge = {
      'host-bridge:demo': {
        getStockLevel: () => 42,
      },
    }

    const Parent = defineComponent({
      setup() {
        provideArrowHostBridge(bridge)
        return () =>
          h(ArrowSandbox, {
            source: 'export default html`<div/>`',
            status: 'ready',
          })
      },
    })

    mount(Parent)
    await nextTick()
    await new Promise((r) => setTimeout(r, 50))

    expect(sandboxMod.sandbox).toHaveBeenCalled()
    const call = vi.mocked(sandboxMod.sandbox).mock.calls[0]
    expect(call?.[2]).toEqual(bridge)
  })
})
