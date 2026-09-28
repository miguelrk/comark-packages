/**
 * comark's SPEC fixtures (synced into `test/fixtures/spec` by `pnpm sync:spec`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '../fixtures/spec')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : name.endsWith('.md') ? [path] : []
  })
}

/** The fenced block under `## Input` (it ends at the next section). */
function inputOf(fixture: string): string | null {
  const start = fixture.indexOf('## Input')
  if (start < 0) return null
  const ends = ['\n## AST', '\n## HTML', '\n## Markdown', '\n## Options'].map(h => fixture.indexOf(h, start)).filter(i => i > 0)
  const section = fixture.slice(start, ends.length ? Math.min(...ends) : undefined)
  const open = /\n(`{3,})\w*\n/.exec(section)
  if (!open) return null
  const body = section.slice(open.index + open[0].length)
  const close = body.lastIndexOf(`\n${open[1]}`)
  return close < 0 ? null : body.slice(0, close)
}

export const fixtures = files(ROOT)
  .map(path => ({ name: relative(ROOT, path), input: inputOf(readFileSync(path, 'utf8')) }))
  .filter((f): f is { name: string, input: string } => f.input !== null)
