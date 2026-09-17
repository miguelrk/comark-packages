import { renderEmail } from 'comark-email'

const MAX_BODY_BYTES = 50_000

export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event)
  if (!raw) {
    throw createError({ statusCode: 400, message: 'Missing request body' })
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, message: 'Request body too large' })
  }

  let markdown: string
  try {
    const body = JSON.parse(raw) as unknown
    if (typeof body !== 'object' || body === null || !('markdown' in body) || typeof (body as { markdown: unknown }).markdown !== 'string') {
      throw new Error('Expected { markdown: string }')
    }
    markdown = (body as { markdown: string }).markdown
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid JSON body. Expected { markdown: string }' })
  }

  try {
    const result = await renderEmail(markdown)
    return result
  } catch (err) {
    throw createError({
      statusCode: 500,
      message: err instanceof Error ? err.message : 'Render failed',
    })
  }
})
