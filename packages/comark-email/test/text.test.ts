import { describe, expect, it } from 'vitest'
import { parseMarkdown } from 'comark'
import { documentToText, renderEmail } from '../src/index.ts'
import { ADVANCED_EMAIL_MARKDOWN, BASIC_EMAIL_MARKDOWN } from './fixtures/markdown.ts'

describe('documentToText', () => {
  it('joins block nodes and keeps link targets', async () => {
    const document = await parseMarkdown(BASIC_EMAIL_MARKDOWN)
    const text = documentToText(document)
    expect(text).toContain('Welcome')
    expect(text).toContain('basic')
    expect(text).toContain('link (https://comark.dev)')
    expect(text).toContain('- Fast rendering')
  })

  it('includes email-button labels and hrefs', async () => {
    const document = await parseMarkdown(ADVANCED_EMAIL_MARKDOWN)
    const text = documentToText(document)
    expect(text).toContain('Order Shipped')
    expect(text).toContain('Track Package (https://example.com/track)')
    expect(text).toContain('Left column content')
    expect(text).toContain('Right column content')
  })
})

describe('renderEmail text', () => {
  it('returns text derived from the document', async () => {
    const { text, html } = await renderEmail(BASIC_EMAIL_MARKDOWN)
    expect(text).toContain('Welcome')
    expect(text).toContain('link (https://comark.dev)')
    expect(html).toContain('Welcome')
  })
})
