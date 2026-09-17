import { describe, expect, it, afterAll } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { renderPdfToBuffer, renderPdfToFile } from '../src/node.ts'

const isPdf = (bytes: Uint8Array) =>
  Buffer.from(bytes.slice(0, 4)).toString('ascii') === '%PDF'

let tmpDir: string

describe('renderPdfToBuffer', () => {
  it('returns PDF bytes', async () => {
    const bytes = await renderPdfToBuffer('# Hello')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(isPdf(bytes)).toBe(true)
  })
})

describe('renderPdfToFile', () => {
  it('writes a valid PDF to disk', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'comark-pdf-test-'))
    const outPath = join(tmpDir, 'output.pdf')
    await renderPdfToFile('# Hello', outPath)
    const bytes = await readFile(outPath)
    expect(isPdf(new Uint8Array(bytes))).toBe(true)
  })

  afterAll(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })
})
