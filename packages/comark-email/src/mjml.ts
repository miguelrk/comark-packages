/**
 * Lazy MJML compilation wrapper (Node-only).
 *
 * `mjml` is loaded on first call. This keeps the light transformer path
 * (`documentToMjmlJson`, `serializeMjml`) tree-shakeable.
 */

import type { MjmlCompileError, MjmlCompileOptions, MjmlNode } from './types.ts'

type Mjml2HtmlFn = (
  input: string | object,
  options?: Record<string, unknown>
) => Promise<{
  html: string
  errors: Array<{ line?: number; message?: string; tagName?: string; formattedMessage?: string }>
}>

let _mjml2html: Mjml2HtmlFn | undefined

const loadMjml = async (): Promise<Mjml2HtmlFn> => {
  if (_mjml2html) return _mjml2html
  try {
    const mod: unknown = await import('mjml')
    const fn =
      typeof mod === 'function'
        ? mod
        : mod !== null && typeof mod === 'object' && 'default' in mod && typeof (mod as { default: unknown }).default === 'function'
          ? (mod as { default: Mjml2HtmlFn }).default
          : undefined
    if (!fn) throw new Error('mjml module did not export a callable function')
    _mjml2html = fn as Mjml2HtmlFn
    return _mjml2html
  } catch {
    throw new Error('[comark-email] failed to load mjml (a comark-email dependency)')
  }
}

/**
 * Compile an MJML JSON tree or XML string to email HTML using the MJML compiler.
 *
 * Returns `{ html, errors }`. On compilation error MJML still returns partial HTML;
 * errors are collected rather than thrown so callers always receive usable output.
 *
 * @param input - MJML JSON tree (`MjmlNode`) or XML string.
 * @param options - Options forwarded to `mjml2html`.
 */
export const compileMjml = async (
  input: MjmlNode | string,
  options?: MjmlCompileOptions
): Promise<{ html: string; errors: MjmlCompileError[] }> => {
  const mjml2html = await loadMjml()
  const errors: MjmlCompileError[] = []
  try {
    const result = await mjml2html(input, {
      validationLevel: 'soft',
      ignoreIncludes: true,
      ...options,
    })
    for (const e of result.errors ?? []) {
      errors.push({
        line: e.line,
        message: e.message ?? String(e),
        tagName: e.tagName,
        formattedMessage: e.formattedMessage,
      })
    }
    return { html: result.html ?? '', errors }
  } catch (err) {
    errors.push({ message: err instanceof Error ? err.message : String(err) })
    return { html: '', errors }
  }
}
