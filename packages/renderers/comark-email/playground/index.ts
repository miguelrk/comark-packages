import { renderEmail } from 'comark-email'
import { ADVANCED_EMAIL_MARKDOWN } from '../test/fixtures/markdown.ts'

const { html, subject, previewText, errors } = await renderEmail(ADVANCED_EMAIL_MARKDOWN)

console.log('subject:', subject)
console.log('previewText:', previewText)
console.log('errors:', errors)
console.log('html length:', html.length)
