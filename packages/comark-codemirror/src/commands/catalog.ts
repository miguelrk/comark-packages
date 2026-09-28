/**
 * The core command catalog: names, descriptions and JSON Schema params for
 * agents (`tools()`, `runCommand()`). Kept out of the editor bundle.
 */
import type { CommandDef } from '../types.ts'
import type { MarkName } from './index.ts'
import { formatTable, insertComponent, insertLink, propsToYaml, setFrontmatter, setHeading, setProps, toggleList, toggleMark, toggleQuote, toggleTask, unwrapComponent, wrapComponent } from './index.ts'

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined)

export const coreCommands: readonly CommandDef[] = [
  {
    name: 'toggleMark',
    description: 'Toggle bold (`**`), italic (`_`), code (`` ` ``) or strikethrough (`~~`) around the selection or the word at the cursor.',
    params: { type: 'object', properties: { mark: { enum: ['bold', 'italic', 'code', 'strike'] } }, required: ['mark'] },
    run: (state, p) => toggleMark(state, p.mark as MarkName),
  },
  {
    name: 'setHeading',
    description: 'Set the heading level of the selected lines. Level 0 makes them paragraphs.',
    params: { type: 'object', properties: { level: { type: 'integer', minimum: 0, maximum: 6 } }, required: ['level'] },
    run: (state, p) => setHeading(state, Number(p.level)),
  },
  {
    name: 'toggleList',
    description: 'Toggle a bullet, ordered or task list on the selected lines.',
    params: { type: 'object', properties: { kind: { enum: ['bullet', 'ordered', 'task'] } }, required: ['kind'] },
    run: (state, p) => toggleList(state, (p.kind as 'bullet') ?? 'bullet'),
  },
  {
    name: 'toggleTask',
    description: 'Check or uncheck the task items in the selection.',
    params: { type: 'object', properties: { checked: { type: 'boolean' } } },
    run: (state, p) => toggleTask(state, typeof p.checked === 'boolean' ? p.checked : undefined),
  },
  {
    name: 'toggleQuote',
    description: 'Toggle a blockquote on the selected lines.',
    run: state => toggleQuote(state),
  },
  {
    name: 'insertLink',
    description: 'Wrap the selection in a Markdown link.',
    params: { type: 'object', properties: { url: { type: 'string' } } },
    run: (state, p) => insertLink(state, str(p.url)),
  },
  {
    name: 'insertComponent',
    description: 'Insert a block (or inline) component at the selection. The selection becomes its content.',
    params: {
      type: 'object',
      properties: { name: { type: 'string' }, props: { type: 'object' }, content: { type: 'string' }, inline: { type: 'boolean' } },
      required: ['name'],
    },
    run: (state, p) => insertComponent(state, str(p.name), { props: obj(p.props), content: typeof p.content === 'string' ? p.content : undefined, inline: p.inline === true }),
  },
  {
    name: 'wrapComponent',
    description: 'Wrap the selected lines in a block component (nesting colons are added as needed).',
    params: { type: 'object', properties: { name: { type: 'string' }, props: { type: 'object' } }, required: ['name'] },
    run: (state, p) => wrapComponent(state, str(p.name), obj(p.props)),
  },
  {
    name: 'unwrapComponent',
    description: 'Remove the component at the cursor and keep its content.',
    run: state => unwrapComponent(state),
  },
  {
    name: 'setProps',
    description: 'Set or remove (value `null`) attributes of the component at the cursor.',
    params: { type: 'object', properties: { props: { type: 'object' } }, required: ['props'] },
    run: (state, p) => setProps(state, obj(p.props) ?? {}),
  },
  {
    name: 'propsToYaml',
    description: 'Move the attribute block of the component at the cursor into a YAML props block.',
    run: state => propsToYaml(state),
  },
  {
    name: 'setFrontmatter',
    description: 'Set a top-level frontmatter key (value `null` removes it). Creates the frontmatter when missing.',
    params: { type: 'object', properties: { key: { type: 'string' }, value: {} }, required: ['key'] },
    run: (state, p) => setFrontmatter(state, str(p.key), p.value ?? null),
  },
  {
    name: 'formatTable',
    description: 'Align the columns of the table at the cursor.',
    run: state => formatTable(state),
  },
]
