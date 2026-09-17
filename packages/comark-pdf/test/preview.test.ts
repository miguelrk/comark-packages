import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '../src/preview.ts'

describe('mount', () => {
  let container: HTMLDivElement
  let revokedUrls: string[]

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    revokedUrls = []

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revokedUrls.push(url)
    })
  })

  afterEach(() => {
    document.body.removeChild(container)
    vi.restoreAllMocks()
  })

  it('appends an iframe with the blob URL as src', () => {
    const bytes = new Uint8Array([37, 80, 68, 70]) // %PDF
    mount(container, bytes)

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.src).toBe('blob:test-url')
  })

  it('sets iframe title to PDF preview', () => {
    mount(container, new Uint8Array())
    const iframe = container.querySelector('iframe')
    expect(iframe?.title).toBe('PDF preview')
  })

  it('revoke() calls URL.revokeObjectURL', () => {
    const handle = mount(container, new Uint8Array())
    handle.revoke()
    expect(revokedUrls).toContain('blob:test-url')
  })

  it('replaces existing content on re-mount', () => {
    mount(container, new Uint8Array())
    mount(container, new Uint8Array())
    expect(container.querySelectorAll('iframe').length).toBe(1)
  })
})
