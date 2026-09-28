import type { ComarkOptions, ComponentDef } from 'comark-codemirror'
import { languages } from '@codemirror/language-data'
import rangi from 'comark-codemirror/plugins/rangi'
import { presetBuiltins } from 'comark-codemirror/presets/builtins'
import { presetEcosystem } from 'comark-codemirror/presets/ecosystem'

export const DEMO_COMPONENTS: ComponentDef[] = [
  {
    name: 'card',
    kind: 'block',
    group: 'Layout',
    description: 'A content card',
    props: {
      title: { type: 'string', required: true, description: 'Card title' },
      icon: { type: 'string', description: 'Icon name, e.g. `i-lucide-star`' },
      variant: { enum: ['soft', 'outline', 'solid'], default: 'soft', description: 'Visual style' },
      color: { enum: ['#0969da', '#1a7f37', '#cf222e', '#8250df'], description: 'Accent color' },
      to: { type: 'string', description: 'Link target' },
    },
    slots: [{ name: 'default' }, { name: 'footer', description: 'Card footer' }],
    example: '::card{title="Hello" variant="outline"}\nBody\n\n#footer\nFooter\n::',
    docs: 'https://comark.dev',
  },
  {
    name: 'badge',
    kind: 'inline',
    group: 'Inline',
    description: 'A small status badge',
    props: { color: { enum: ['neutral', 'green', 'red', 'amber'] } },
    slots: [{ name: 'default' }],
  },
  {
    name: 'steps',
    kind: 'block',
    group: 'Layout',
    description: 'Numbered steps from h3 headings',
    props: { level: { enum: ['2', '3', '4'], default: '3' } },
  },
  {
    name: 'input',
    kind: 'inline',
    group: 'Forms',
    description: 'A form input',
    props: { value: { type: 'string', model: true }, type: { enum: ['text', 'email', 'number'] }, name: { type: 'string' } },
  },
]

export const DEMO_DATA = {
  user: { name: 'Ada', email: 'ada@example.com' },
  posts: [{ title: 'Hello Comark', slug: 'hello', draft: false }, { title: 'Chained menus', slug: 'menus', draft: true }],
}

export const DEMO_OPTIONS: ComarkOptions = {
  plugins: [...presetBuiltins(), ...presetEcosystem(), rangi()],
  components: DEMO_COMPONENTS,
  data: DEMO_DATA,
  frontmatterSchema: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', description: 'Page title' },
      layout: { enum: ['docs', 'page', 'blog'], description: 'Page layout' },
      draft: { type: 'boolean' },
      seo: { type: 'object', properties: { image: { type: 'string' }, description: { type: 'string' } } },
    },
  },
  links: [
    { url: '/getting-started/introduction', title: 'Introduction' },
    { url: '/autocomplete/tour', title: 'Autocomplete tour' },
    { url: '/og.png', title: 'Social image', kind: 'asset' },
  ],
  codeLanguages: languages,
}

export const DEMOS: Record<string, string> = {
  tour: `---
title: Chained autocomplete
layout: docs
site:
  name: My Blog
---

# {{ frontmatter.title }}

Type \`/\` on an empty line, \`::\` for a component, \`{{\` for a binding.

::card{title="Hello" variant="soft"}
Written for {{ frontmatter.site.name }}.

#footer
:badge[new]{color="green"}
::
`,
  components: `::card{title="Components" variant="outline"}
Props, values and slots complete as one chain.
::

`,
  bindings: `---
title: Bindings
author:
  name: Ada
  role: Maintainer
---

Written by {{ frontmatter.author.name }}.

::for{:each="data.posts" item="post"}
- {{ post.title }}
::

`,
  plugins: `> [!TIP]
> Alerts, emoji :rocket:, footnotes[^1] and math $e^{i\\pi}$ all complete.

\`\`\`ts [example.ts]
const answer = 42
\`\`\`

[^1]: Like this one.
`,
}

/** The tour: each step appends a snippet and opens the menu at its cursor (`|`). */
export const TOUR = [
  { title: 'Block menu', trigger: '/', insert: '/|', text: 'A slash on an empty line lists components, structure, callouts, code and snippets.' },
  { title: 'Components', trigger: '::', insert: '::|', text: 'Pick a component: its props menu opens next.' },
  { title: 'Props', trigger: '{', insert: '::card{|}\n::', text: 'Required props first; props already set are hidden. `=` accepts.' },
  { title: 'Values', trigger: '="', insert: '::card{variant="|"}\n::', text: 'Enum values, booleans, defaults and values used elsewhere.' },
  { title: 'Bound props', trigger: ':', insert: '::card{:title="|"}\n::', text: '`:prop` binds to data: roots, then keys, segment by segment.' },
  { title: 'Bindings', trigger: '{{', insert: '{{ frontmatter.| }}', text: 'Keys come from this document\'s live frontmatter, with values.' },
  { title: 'Slots', trigger: '#', insert: '::card\n#|\n::', text: 'Slots of the innermost component.' },
  { title: 'YAML props', trigger: '---', insert: '::card\n---\n|\n---\n::', text: 'The same props, as YAML keys under the opener.' },
  { title: 'Inline components', trigger: ':', insert: 'Status: :ba|', text: 'Inline components and emoji share the `:` trigger.' },
  { title: 'Emoji', trigger: ':', insert: 'Ship it :ro|', text: 'Emoji show their glyph.' },
  { title: 'Alerts', trigger: '> [!', insert: '> [!|', text: 'GitHub-style alerts.' },
  { title: 'Fences', trigger: '```', insert: '```|', text: 'Languages, then meta: `[file]`, `{1,3}`, `diff`, `twoslash`.' },
  { title: 'Anchors', trigger: '](#', insert: 'See [the top](#|)', text: 'Heading ids exactly as comark generates them.' },
  { title: 'Math', trigger: '$\\', insert: '$\\fr|$', text: 'KaTeX commands with their symbols.' },
  { title: 'Loop variables', trigger: '{{', insert: '::for{:each="data.posts" item="post"}\n{{ post.| }}\n::', text: '`::for` introduces `post` with the shape of `data.posts`.' },
] as const
