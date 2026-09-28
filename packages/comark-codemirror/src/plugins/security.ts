/**
 * Security: the same options as comark's security plugin. The editor
 * reports what the renderer would drop (blocked tags, unsafe protocols,
 * inline event handlers) while you write, and the html plugin stops
 * completing blocked tags.
 */
import type { Diagnostic } from '@codemirror/lint'
import type { EditorPlugin } from '../types.ts'
import { definePlugin } from '../plugins.ts'

export interface SecurityOptions {
  blockedTags?: string[]
  allowedTags?: string[]
  allowedProtocols?: string[]
  allowedLinkPrefixes?: string[]
  allowedImagePrefixes?: string[]
  allowDataImages?: boolean
}

const DANGEROUS = /^\s*(?:javascript|vbscript|data(?!:image\/))\s*:/i

export default definePlugin<SecurityOptions>((options = {}): EditorPlugin & { blockedTags: readonly string[] } => {
  const blockedTags = (options.blockedTags ?? ['script', 'iframe', 'object', 'embed', 'style']).map(t => t.toLowerCase())
  const blocked = new Set(blockedTags)
  const allowed = new Set((options.allowedTags ?? []).map(t => t.toLowerCase()))
  return {
    name: 'security',
    blockedTags,
    lint: [({ state }) => {
      const out: Diagnostic[] = []
      const text = state.doc.toString()
      for (const m of text.matchAll(/<\/?([A-Za-z][\w-]*)\b[^>]*>/g)) {
        const tag = m[1]!.toLowerCase()
        if (blocked.has(tag) || (allowed.size && !allowed.has(tag))) out.push({ from: m.index, to: m.index + m[0].length, severity: 'error', source: 'security', message: `\`<${tag}>\` is removed by the security plugin.` })
        const handler = /\son\w+\s*=/i.exec(m[0])
        if (handler) out.push({ from: m.index + handler.index + 1, to: m.index + handler.index + handler[0].length, severity: 'error', source: 'security', message: 'Inline event handlers are not allowed.' })
      }
      for (const m of text.matchAll(/(!?)\[[^\]]*\]\(\s*([^)\s]+)/g)) {
        const url = m[2]!
        const image = m[1] === '!'
        const at = m.index + m[0].lastIndexOf(url)
        if (DANGEROUS.test(url) && !(image && options.allowDataImages && url.startsWith('data:image/'))) {
          out.push({ from: at, to: at + url.length, severity: 'error', source: 'security', message: `Unsafe URL protocol in ${image ? 'image' : 'link'}.` })
          continue
        }
        const proto = /^([a-z][\w+.-]*):/i.exec(url)?.[1]?.toLowerCase()
        if (proto && options.allowedProtocols && !options.allowedProtocols.includes('*') && !options.allowedProtocols.includes(proto)) {
          out.push({ from: at, to: at + url.length, severity: 'warning', source: 'security', message: `Protocol \`${proto}:\` is not allowed.` })
        }
        const prefixes = image ? options.allowedImagePrefixes : options.allowedLinkPrefixes
        if (prefixes && !prefixes.includes('*') && /^[a-z]+:/i.test(url) && !prefixes.some(p => url.startsWith(p))) {
          out.push({ from: at, to: at + url.length, severity: 'warning', source: 'security', message: `${image ? 'Image' : 'Link'} is not in the allowed prefixes.` })
        }
      }
      return out
    }],
    llms: `Security: ${blockedTags.map(t => `\`<${t}>\``).join(', ')} and \`javascript:\` URLs are removed; do not use inline event handlers.`,
  }
})
