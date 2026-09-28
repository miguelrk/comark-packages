/**
 * Comark syntax for CodeMirror: `@lezer/markdown` (CommonMark + GFM) plus one
 * `MarkdownConfig` for Comark constructs. Frontmatter and component props
 * blocks are nested YAML (`@codemirror/lang-yaml`); fenced code uses the
 * languages the host or plugins pass.
 */
import type { LanguageDescription, LanguageSupport } from '@codemirror/language'
import type { BlockContext, Element, InlineContext, Line, MarkdownConfig } from '@lezer/markdown'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { yamlLanguage } from '@codemirror/lang-yaml'
import { parseMixed } from '@lezer/common'
import { Tag, tags } from '@lezer/highlight'
import { scanAttributes } from './document/attributes.ts'

/** Highlight tags of Comark nodes (subtags of standard tags, so any theme colors them). */
export const comarkTags = {
  mark: Tag.define(tags.processingInstruction),
  component: Tag.define(tags.typeName),
  attribute: Tag.define(tags.attributeName),
  attributeValue: Tag.define(tags.attributeValue),
  className: Tag.define(tags.className),
  id: Tag.define(tags.labelName),
  binding: Tag.define(tags.variableName),
  bindingDefault: Tag.define(tags.string),
  math: Tag.define(tags.string),
  alert: Tag.define(tags.keyword),
  meta: Tag.define(tags.meta),
  slot: Tag.define(tags.labelName),
}

type Cx = BlockContext | InlineContext

const restOf = (line: Line) => line.text.slice(line.pos)

const inputOf = (cx: BlockContext) =>
  (cx as unknown as { input: { read: (from: number, to: number) => string, length: number } }).input

const FM_CLOSE = /^(?:---|\.\.\.)[ \t]*$/

/** Element children for an attribute block at document offset `at` (`text[start] === '{'`). */
function attributeElements(cx: Cx, text: string, start: number, at: number): { element: Element, end: number } {
  const { tokens, end } = scanAttributes(text, start, at - start)
  const children = tokens.map((t) => {
    const name = t.type === 'open' || t.type === 'close'
      ? 'AttrBrace'
      : t.type === 'class' ? 'AttrClass' : t.type === 'id' ? 'AttrId' : t.type === 'key' ? 'AttrKey' : t.type === 'equals' ? 'AttrEquals' : 'AttrValue'
    return cx.elt(name, t.from, t.to)
  })
  return { element: cx.elt('Attribute', at, at + (end - start), children), end }
}

/** Lezer markdown extension for Comark. */
export const comarkMarkdown: MarkdownConfig = {
  defineNodes: [
    {
      name: 'Component',
      block: true,
      // `value` packs the colon count and the opener's indentation (colons + indent * 1000)
      composite(cx, line, value) {
        const raw = restOf(line)
        const marker = ':'.repeat(value % 1000)
        // a closer closes the component whose opener is at the same or a deeper indentation,
        // so nested components with the same colon count close innermost-first (like comark)
        if (raw.trim() !== marker || line.indent > Math.floor(value / 1000)) {
          // comark strips indentation inside components: nested content is never an indented code block
          if (line.indent > line.baseIndent) line.moveBaseColumn(line.indent)
          return true
        }
        const at = line.pos + raw.indexOf(marker)
        line.addMarker(cx.elt('ComponentMark', cx.lineStart + at, cx.lineStart + at + marker.length))
        line.moveBase(line.text.length)
        return false
      },
    },
    { name: 'ComponentMark', style: comarkTags.mark },
    { name: 'ComponentName', style: comarkTags.component },
    { name: 'ComponentProps', block: true },
    { name: 'PropsMark', style: comarkTags.mark },
    { name: 'PropsContent' },
    { name: 'Attribute' },
    { name: 'AttrBrace', style: comarkTags.mark },
    { name: 'AttrClass', style: comarkTags.className },
    { name: 'AttrId', style: comarkTags.id },
    { name: 'AttrKey', style: comarkTags.attribute },
    { name: 'AttrEquals', style: comarkTags.mark },
    { name: 'AttrValue', style: comarkTags.attributeValue },
    { name: 'Slot', block: true },
    { name: 'SlotMark', style: comarkTags.slot },
    { name: 'SlotName', style: comarkTags.slot },
    { name: 'Frontmatter', block: true },
    { name: 'FrontmatterMark', style: comarkTags.meta },
    { name: 'FrontmatterContent' },
    { name: 'MathBlock', block: true },
    { name: 'MathMark', style: comarkTags.mark },
    { name: 'MathText', style: comarkTags.math },
    { name: 'Math', style: comarkTags.math },
    { name: 'Binding' },
    { name: 'BindingMark', style: comarkTags.mark },
    { name: 'BindingPath', style: comarkTags.binding },
    { name: 'BindingOperator', style: comarkTags.mark },
    { name: 'BindingDefault', style: comarkTags.bindingDefault },
    { name: 'InlineComponent' },
    { name: 'InlineComponentMark', style: comarkTags.mark },
    { name: 'InlineComponentName', style: comarkTags.component },
    { name: 'Alert', style: comarkTags.alert },
    { name: 'Footnote', style: tags.link },
    { name: 'Summary', style: comarkTags.meta },
  ],
  parseBlock: [
    {
      name: 'Frontmatter',
      before: 'HorizontalRule',
      parse(cx, line) {
        if (cx.lineStart !== 0 || cx.parentType().name !== 'Document' || !/^---[ \t]*$/.test(line.text)) return false
        const input = inputOf(cx)
        const source = input.read(0, Math.min(input.length, 200_000)).split('\n')
        const closer = source.findIndex((l, i) => i > 0 && FM_CLOSE.test(l))
        // an empty `---\n---` is two thematic breaks (comark)
        if (closer < 2) return false
        const children = [cx.elt('FrontmatterMark', 0, 3)]
        let contentFrom = -1
        let contentTo = -1
        while (cx.nextLine()) {
          if (FM_CLOSE.test(line.text)) {
            if (contentFrom >= 0) children.push(cx.elt('FrontmatterContent', contentFrom, contentTo))
            children.push(cx.elt('FrontmatterMark', cx.lineStart, cx.lineStart + 3))
            cx.nextLine()
            break
          }
          if (contentFrom < 0) contentFrom = cx.lineStart
          contentTo = cx.lineStart + line.text.length
        }
        cx.addElement(cx.elt('Frontmatter', 0, cx.prevLineEnd(), children))
        return true
      },
    },
    {
      name: 'ComponentProps',
      before: 'HorizontalRule',
      parse(cx, line) {
        if (cx.parentType().name !== 'Component' || restOf(line).trim() !== '---') return false
        const input = inputOf(cx)
        const head = input.read(Math.max(0, cx.lineStart - 2000), Math.max(0, cx.lineStart - 1))
        const prev = head.slice(head.lastIndexOf('\n') + 1)
        if (!/^(?:\s*(?:(?:[-*+]|\d{1,9}[.)])\s+|>\s?))*\s*:{2,}[A-Za-z$]/.test(prev)) return false
        const open = cx.lineStart + line.pos
        const children = [cx.elt('PropsMark', open, open + 3)]
        let contentFrom = -1
        let contentTo = -1
        while (cx.nextLine()) {
          if (restOf(line).trim() === '---') {
            if (contentFrom >= 0) children.push(cx.elt('PropsContent', contentFrom, contentTo))
            const at = cx.lineStart + line.pos
            children.push(cx.elt('PropsMark', at, at + 3))
            cx.nextLine()
            break
          }
          if (contentFrom < 0) contentFrom = cx.lineStart + line.pos
          contentTo = cx.lineStart + line.text.length
        }
        cx.addElement(cx.elt('ComponentProps', open, cx.prevLineEnd(), children))
        return true
      },
    },
    {
      name: 'Component',
      before: 'FencedCode',
      endLeaf(_cx, line) {
        return /^:{2,}[A-Za-z$]/.test(restOf(line)) || /^:{2,}\s*$/.test(restOf(line))
      },
      parse(cx, line) {
        if (line.indent >= line.baseIndent + 4) return false
        const raw = restOf(line)
        const match = /^(:{2,})([A-Za-z$][\w$.-]*)/.exec(raw)
        if (!match) return false
        const from = cx.lineStart + line.pos
        const markTo = from + match[1]!.length
        const nameTo = markTo + match[2]!.length
        cx.startComposite('Component', line.pos, match[1]!.length + line.indent * 1000)
        cx.addElement(cx.elt('ComponentMark', from, markTo))
        cx.addElement(cx.elt('ComponentName', markTo, nameTo))
        let rest = match[0].length
        const label = /^\[[^\]]*\]/.exec(raw.slice(rest))
        if (label) rest += label[0].length
        if (raw[rest] === '{') cx.addElement(attributeElements(cx, raw, rest, from + rest).element)
        line.moveBase(line.text.length)
        return null
      },
    },
    {
      name: 'MathBlock',
      before: 'FencedCode',
      endLeaf(_cx, line) {
        return restOf(line).trim() === '$$'
      },
      parse(cx, line) {
        const raw = restOf(line)
        if (raw.trim() !== '$$') return false
        const from = cx.lineStart + line.pos + raw.indexOf('$$')
        const children = [cx.elt('MathMark', from, from + 2)]
        while (cx.nextLine()) {
          const body = restOf(line)
          if (body.trim() === '$$') {
            const at = cx.lineStart + line.pos + body.indexOf('$$')
            children.push(cx.elt('MathMark', at, at + 2))
            cx.nextLine()
            break
          }
          if (line.text.length) children.push(cx.elt('MathText', cx.lineStart, cx.lineStart + line.text.length))
        }
        cx.addElement(cx.elt('MathBlock', from, Math.max(cx.prevLineEnd(), from + 2), children))
        return true
      },
    },
    {
      name: 'SummaryBlock',
      before: 'HTMLBlock',
      parse(cx, line) {
        const match = /^<!--[ \t]*more[ \t]*-->[ \t]*$/.exec(restOf(line))
        if (!match) return false
        const from = cx.lineStart + line.pos
        cx.nextLine()
        cx.addElement(cx.elt('Summary', from, from + match[0].trimEnd().length))
        return true
      },
    },
    {
      name: 'Slot',
      before: 'ATXHeading',
      parse(cx, line) {
        if (cx.parentType().name !== 'Component') return false
        const raw = restOf(line)
        const match = /^#([A-Za-z][\w-]*)(?=\{|[ \t]*$)/.exec(raw)
        if (!match) return false
        const from = cx.lineStart + line.pos
        const children = [cx.elt('SlotMark', from, from + 1), cx.elt('SlotName', from + 1, from + match[0].length)]
        let to = from + match[0].length
        if (raw[match[0].length] === '{') {
          const attrs = attributeElements(cx, raw, match[0].length, to)
          children.push(attrs.element)
          to = from + attrs.end
        }
        cx.nextLine()
        cx.addElement(cx.elt('Slot', from, to, children))
        return true
      },
    },
    {
      name: 'ComponentClose',
      parse(cx, line) {
        const raw = restOf(line)
        if (!/^:{2,}[ \t]*$/.test(raw)) return false
        const marker = raw.trim()
        const from = cx.lineStart + line.pos
        cx.nextLine()
        cx.addElement(cx.elt('ComponentMark', from, from + marker.length))
        return true
      },
    },
  ],
  parseInline: [
    {
      name: 'Summary',
      before: 'HTMLTag',
      parse(cx, next, pos) {
        if (next !== 60) return -1
        const match = /^<!--[ \t]*more[ \t]*-->/.exec(cx.slice(pos, cx.end))
        return match ? cx.addElement(cx.elt('Summary', pos, pos + match[0].length)) : -1
      },
    },
    {
      name: 'Alert',
      before: 'Link',
      parse(cx, next, pos) {
        if (next !== 91) return -1
        const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(cx.slice(pos, cx.end))
        return match ? cx.addElement(cx.elt('Alert', pos, pos + match[0].length)) : -1
      },
    },
    {
      name: 'Footnote',
      before: 'Link',
      parse(cx, next, pos) {
        if (next !== 91 || cx.char(pos + 1) !== 94) return -1
        const match = /^\[\^[^\]\s]+\]/.exec(cx.slice(pos, cx.end))
        return match ? cx.addElement(cx.elt('Footnote', pos, pos + match[0].length)) : -1
      },
    },
    {
      name: 'Binding',
      before: 'Emphasis',
      parse(cx, next, pos) {
        if (next !== 123 || cx.char(pos + 1) !== 123) return -1
        const match = /^\{\{([^{}\n]*)\}\}/.exec(cx.slice(pos, cx.end))
        // like comark, an empty `{{}}` is not a binding
        if (!match || !match[1]!.trim()) return -1
        const end = pos + match[0].length
        const inner = match[1]!
        const children = [cx.elt('BindingMark', pos, pos + 2)]
        const or = inner.indexOf('||')
        const path = or < 0 ? inner : inner.slice(0, or)
        const lead = path.length - path.trimStart().length
        let at = pos + 2 + lead
        if (path.trim()) children.push(cx.elt('BindingPath', at, at + path.trim().length))
        if (or >= 0) {
          at = pos + 2 + or
          children.push(cx.elt('BindingOperator', at, at + 2))
          const fallback = inner.slice(or + 2)
          at += 2 + fallback.length - fallback.trimStart().length
          if (fallback.trim()) children.push(cx.elt('BindingDefault', at, at + fallback.trim().length))
        }
        children.push(cx.elt('BindingMark', end - 2, end))
        return cx.addElement(cx.elt('Binding', pos, end, children))
      },
    },
    {
      name: 'Math',
      before: 'Emphasis',
      parse(cx, next, pos) {
        if (next !== 36) return -1
        const slice = cx.slice(pos, cx.end)
        const match = /^\$\$[^$\n]+\$\$/.exec(slice) ?? /^\$(?=[^\s$])(?:\\.|[^$\\\n])+?(?<=\S)\$(?!\d)/.exec(slice)
        return match ? cx.addElement(cx.elt('Math', pos, pos + match[0].length)) : -1
      },
    },
    {
      name: 'InlineComponent',
      before: 'Emoji',
      parse(cx, next, pos) {
        if (next !== 58) return -1
        const prev = pos > cx.offset ? cx.char(pos - 1) : -1
        if (prev === 58 || (prev >= 48 && prev <= 57) || (prev >= 65 && prev <= 90) || (prev >= 97 && prev <= 122) || prev === 95) return -1
        const text = cx.slice(pos, cx.end)
        const match = /^:([A-Za-z][\w-]*)(\[[^\]\n]*\])?/.exec(text)
        if (!match) return -1
        let end = pos + match[0].length
        // `:smile:` is an emoji
        if (!match[2] && text[match[0].length] === ':') return -1
        const children = [cx.elt('InlineComponentMark', pos, pos + 1), cx.elt('InlineComponentName', pos + 1, pos + 1 + match[1]!.length)]
        if (text[match[0].length] === '{') {
          const attrs = attributeElements(cx, text, match[0].length, end)
          children.push(attrs.element)
          end = pos + attrs.end
        }
        return cx.addElement(cx.elt('InlineComponent', pos, end, children))
      },
    },
    {
      name: 'Attribute',
      parse(cx, next, pos) {
        if (next !== 123 || cx.char(pos + 1) === 123) return -1
        const text = cx.slice(pos, cx.end)
        if (!/^\{(?=[.#@:]|[\w:-]+[ \t]*=|[\w-]+(?:[ \t]|\}))[^}\n]*\}/.test(text)) return -1
        const prev = pos > cx.offset ? String.fromCharCode(cx.char(pos - 1)) : ''
        // attributes follow an inline element, or end a heading/paragraph line after a space
        const close = text.indexOf('}')
        const endsLine = /^[ \t]*(?:\n|$)/.test(text.slice(close + 1))
        if (!/[*_~`)\]}]/.test(prev) && !(prev === ' ' && endsLine)) return -1
        const attrs = attributeElements(cx, text, 0, pos)
        return cx.addElement(attrs.element)
      },
    },
  ],
  wrap: parseMixed(node =>
    node.name === 'FrontmatterContent' || node.name === 'PropsContent' ? { parser: yamlLanguage.parser } : null),
}

export const comarkHighlightStyle = HighlightStyle.define([
  { tag: comarkTags.mark, class: 'cm-comark-mark' },
  { tag: comarkTags.component, class: 'cm-comark-component' },
  { tag: comarkTags.attribute, class: 'cm-comark-attr' },
  { tag: comarkTags.attributeValue, class: 'cm-comark-value' },
  { tag: comarkTags.className, class: 'cm-comark-class' },
  { tag: comarkTags.id, class: 'cm-comark-id' },
  { tag: comarkTags.binding, class: 'cm-comark-binding' },
  { tag: comarkTags.bindingDefault, class: 'cm-comark-value' },
  { tag: comarkTags.math, class: 'cm-comark-math' },
  { tag: comarkTags.alert, class: 'cm-comark-alert' },
  { tag: comarkTags.meta, class: 'cm-comark-meta' },
  { tag: comarkTags.slot, class: 'cm-comark-slot' },
])

export const comarkHighlight = syntaxHighlighting(comarkHighlightStyle)

export interface ComarkLanguageOptions {
  /** Languages for fenced code. */
  codeLanguages?: readonly LanguageDescription[]
}

/** Markdown (GFM) with Comark syntax, YAML frontmatter and props, and fenced code languages. */
export function comarkLanguage(options: ComarkLanguageOptions = {}): LanguageSupport {
  return markdown({
    base: markdownLanguage,
    extensions: comarkMarkdown,
    addKeymap: true,
    completeHTMLTags: false,
    pasteURLAsLink: true,
    codeLanguages: options.codeLanguages ? [...options.codeLanguages] : undefined,
  })
}
