/**
 * Real typing in real browsers: chained menus, commit keys, drill-in and
 * back, snippet fields, quiet prose, and the rendered menu anatomy.
 */
import type { ComponentDef } from '../../src/index.ts'
import { closeBrackets, closeBracketsKeymap, completionKeymap, completionStatus } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { comark } from '../../src/index.ts'
import { presetBuiltins } from '../../src/presets/builtins.ts'

const components: ComponentDef[] = [
  {
    name: 'card',
    kind: 'block',
    description: 'A content card',
    group: 'Layout',
    props: {
      title: { type: 'string', required: true, description: 'Heading of the card' },
      variant: { enum: ['primary', 'ghost'], description: 'Visual style' },
      flat: { type: 'boolean' },
    },
    slots: [{ name: 'default' }, { name: 'footer', description: 'Bottom area' }],
    example: '::card{title="Hello" variant="ghost"}\nBody\n::',
  },
]

let view: EditorView | undefined

function mount(doc = '', pos = doc.length) {
  const parent = document.createElement('div')
  parent.style.cssText = 'width: 640px; height: 360px; font: 14px/1.5 ui-monospace, monospace;'
  document.body.append(parent)
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor: pos },
      extensions: [
        history(),
        closeBrackets(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        comark({ components, plugins: presetBuiltins() }),
      ],
    }),
  })
  view.focus()
  return view
}

afterEach(() => {
  view?.dom.parentElement?.remove()
  view?.destroy()
  view = undefined
})

const text = () => view!.state.doc.toString()
const cursor = () => view!.state.selection.main.head
const menu = () => document.querySelector('.cm-tooltip-autocomplete')
const labels = () => [...document.querySelectorAll('.cm-tooltip-autocomplete .cm-completionLabel')].map(e => e.textContent)
const open = () => completionStatus(view!.state) === 'active' && !!menu()

async function until(check: () => boolean, what: string) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > 2000) throw new Error(`timed out waiting for ${what}; doc=${JSON.stringify(text())} labels=${JSON.stringify(labels())}`)
    await new Promise(r => setTimeout(r, 20))
  }
}

/** Wait for the menu, then past CodeMirror's `interactionDelay` (accept keys are ignored right after it opens). */
async function waitMenu(label?: string) {
  await until(() => open() && (!label || labels().includes(label)), `menu${label ? ` with ${label}` : ''}`)
  await new Promise(r => setTimeout(r, 100))
}

describe('chained completion', () => {
  it('walks component → props → value → next prop', async () => {
    mount()
    await userEvent.keyboard('::ca')
    await waitMenu('::card')
    await userEvent.keyboard('{Enter}')
    expect(text()).toBe('::card{}\n\n::')
    expect(cursor()).toBe(7)
    await waitMenu('title')
    expect(labels().slice(0, 3)).toEqual(['title', 'variant', 'flat'])

    await userEvent.keyboard('var')
    await waitMenu('variant')
    await userEvent.keyboard('{Enter}')
    expect(text()).toBe('::card{variant=""}\n\n::')
    await waitMenu('primary')
    expect(labels()).toEqual(['primary', 'ghost'])

    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(text()).toBe('::card{variant="ghost"}\n\n::')
    expect(cursor()).toBe('::card{variant="ghost"'.length)
    await waitMenu('title')
    expect(labels()).not.toContain('variant')

    await userEvent.keyboard('{Escape}')
    expect(open()).toBe(false)
  })

  it('accepts with commit keys instead of typing them twice', async () => {
    mount()
    await userEvent.keyboard('::ca')
    await waitMenu('::card')
    await userEvent.keyboard('{{')
    expect(text()).toBe('::card{}\n\n::')
    await waitMenu('variant')
    await userEvent.keyboard('va=')
    expect(text()).toBe('::card{variant=""}\n\n::')
    await waitMenu('primary')
  })

  it('goes back one step with ← and drills in with →', async () => {
    mount()
    await userEvent.keyboard('::ca')
    await waitMenu('::card')
    await userEvent.keyboard('{Enter}')
    await waitMenu('variant')
    await userEvent.keyboard('var{Enter}')
    await waitMenu('primary')
    await userEvent.keyboard('{ArrowLeft}')
    await waitMenu('variant')
    expect(text()).toBe('::card{var}\n\n::')
    // → on an item with a next level accepts it
    await userEvent.keyboard('{ArrowRight}')
    await waitMenu('primary')
    expect(text()).toBe('::card{variant=""}\n\n::')
  })

  it('walks binding paths segment by segment', async () => {
    mount('---\nsite:\n  name: Blog\n---\n\n')
    await userEvent.keyboard('{{{{')
    expect(text().endsWith('{{}}')).toBe(true)
    await waitMenu('frontmatter')
    await userEvent.keyboard('{ArrowRight}')
    await waitMenu('site')
    await userEvent.keyboard('si.')
    await waitMenu('name')
    await userEvent.keyboard('{Enter}')
    expect(text().endsWith('{{frontmatter.site.name}}')).toBe(true)
  })

  it('moves through snippet fields with Tab and opens the next menu', async () => {
    mount()
    await userEvent.keyboard('::ca')
    await waitMenu('::card')
    await userEvent.keyboard('{Enter}')
    await waitMenu('title')
    await userEvent.keyboard('{Escape}{Tab}')
    expect(cursor()).toBe('::card{}\n'.length)
    await userEvent.keyboard('Body')
    expect(text()).toBe('::card{}\nBody\n::')
  })

  it('opens the block menu on `/` and replaces the slash', async () => {
    mount()
    await userEvent.keyboard('/tab')
    await waitMenu('Table')
    await userEvent.keyboard('{Enter}')
    expect(text()).toBe('| Column | Column |\n| --- | --- |\n|  |  |')
  })

  it('stays quiet while typing prose', async () => {
    mount()
    await userEvent.keyboard('Plain words: nothing to complete here')
    await new Promise(r => setTimeout(r, 250))
    expect(open()).toBe(false)
  })
})

describe('menu anatomy', () => {
  it('renders breadcrumbs, icons, chevrons and the docs panel', async () => {
    mount('::card{}\n::', 7)
    await userEvent.keyboard('{Control>} {/Control}')
    await waitMenu('title')
    expect(document.querySelector('.cm-comark-section')!.textContent).toBe('::card›props')
    expect(document.querySelector('.cm-completionIcon-prop')).not.toBeNull()
    expect(document.querySelectorAll('.cm-comark-chevron').length).toBeGreaterThan(0)
    await until(() => !!document.querySelector('.cm-completionInfo .cm-comark-info'), 'docs panel')
    expect(document.querySelector('.cm-comark-info-title')!.textContent).toBe('title')
    await page.screenshot({ path: `__screenshots__/props-menu-${navigator.userAgent.includes('Firefox') ? 'firefox' : navigator.userAgent.includes('Chrome') ? 'chromium' : 'webkit'}.png` })
  })

  it('highlights component examples in the docs panel', async () => {
    mount()
    await userEvent.keyboard('::ca')
    await waitMenu('::card')
    await until(() => !!document.querySelector('.cm-comark-example .cm-comark-component'), 'highlighted example')
    expect(document.querySelector('.cm-comark-info-rows')!.textContent).toContain('variant')
  })
})
