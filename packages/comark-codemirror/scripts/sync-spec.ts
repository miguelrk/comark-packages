/**
 * Copy comark's SPEC fixtures (Input / AST / HTML / Markdown sections) into
 * `test/fixtures/spec` so the conformance suite runs without a comark checkout.
 *
 *   COMARK_DIR=../../../comark pnpm sync:spec
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const comark = resolve(process.env.COMARK_DIR ?? join(import.meta.dirname, '../../../../comark'))
const source = join(comark, 'packages/comark/SPEC')
const target = join(import.meta.dirname, '../test/fixtures/spec')

if (!existsSync(source)) {
  console.error(`comark SPEC not found at ${source}. Set COMARK_DIR to a comark checkout.`)
  process.exit(1)
}
rmSync(target, { recursive: true, force: true })
cpSync(source, target, { recursive: true, filter: src => !src.endsWith('auto-close.md') })
console.log(`Synced ${source} → ${target}`)
