<script setup lang="ts">
import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import type { Tool } from 'comark-codemirror/agent'
import { startCompletion } from '@codemirror/autocomplete'
import { createHtmlRenderer } from '@comark/html'
import alert from '@comark/html/plugins/alert'
import binding, { Binding } from '@comark/html/plugins/binding'
import emoji from '@comark/html/plugins/emoji'
import footnotes from '@comark/html/plugins/footnotes'
import taskList from '@comark/html/plugins/task-list'
import { diagnose } from 'comark-codemirror'
import { llms, tools as agentTools } from 'comark-codemirror/agent'
import { DEMO_DATA, DEMO_OPTIONS, DEMOS, TOUR } from '~/utils/demos'

definePageMeta({
  layout: 'default',
  footer: false,
})

useSeoMeta({ title: 'Playground', description: 'Try comark-codemirror: chained autocomplete for every Comark construct, with a live preview and the agent tools.' })

const route = useRoute()
const doc = ref(DEMOS[String(route.query.demo ?? '')] ?? DEMOS.tour!)
const view = shallowRef<EditorView>()
const tab = ref<'tour' | 'agent' | 'problems' | 'llms'>('tour')
const diagnostics = shallowRef<Diagnostic[]>([])
const preview = ref('')

function onReady(v: EditorView) {
  view.value = v
  tools.value = agentTools(v)
  refresh()
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(doc, () => {
  clearTimeout(timer)
  timer = setTimeout(refresh, 200)
})

const render = createHtmlRenderer({ plugins: [alert(), binding(), emoji(), footnotes(), taskList()], components: { Binding }, data: { data: DEMO_DATA } })

async function refresh() {
  if (!view.value) return
  diagnostics.value = diagnose(view.value.state)
  try {
    preview.value = await render(doc.value)
  }
  catch (error) {
    preview.value = `<pre class="text-error">${String(error)}</pre>`
  }
}

/** Append a tour step's snippet and open the menu at its cursor. */
function tourStep(insert: string) {
  const v = view.value
  if (!v) return
  const at = v.state.doc.length
  const prefix = v.state.doc.toString().endsWith('\n\n') ? '' : v.state.doc.toString().endsWith('\n') ? '\n' : '\n\n'
  const cursor = insert.indexOf('|')
  v.dispatch({
    changes: { from: at, insert: prefix + insert.replace('|', '') },
    selection: { anchor: at + prefix.length + cursor },
    scrollIntoView: true,
  })
  v.focus()
  startCompletion(v)
}

// agent tools
const tools = shallowRef<Tool[]>([])
const toolName = ref('complete')
const toolInput = ref('{ "line": 12, "column": 8 }')
const toolLog = ref<{ name: string, input: string, output: string, ok: boolean }[]>([])
const selectedTool = computed(() => tools.value.find(t => t.name === toolName.value))
const EXAMPLES: Record<string, unknown> = {
  complete: { line: 12, column: 8 },
  read: { around: { component: 'card' } },
  replace: { search: 'Hello', replace: 'Hi' },
  edit: { target: { component: 'card' }, mode: 'append', content: 'Added by an agent.' },
  insertComponent: { name: 'card', props: { title: 'From an agent' }, content: 'Hello' },
  setProps: { target: { component: 'card' }, props: { variant: 'outline' } },
  setFrontmatter: { key: 'draft', value: true },
  patch: { diff: '@@ -1,1 +1,1 @@\n----\n+---' },
}
watch(toolName, name => (toolInput.value = JSON.stringify(EXAMPLES[name] ?? {}, null, 2)))

async function runTool() {
  const tool = selectedTool.value
  if (!tool) return
  let input: Record<string, unknown>
  try {
    input = JSON.parse(toolInput.value || '{}')
  }
  catch (error) {
    toolLog.value.unshift({ name: tool.name, input: toolInput.value, output: String(error), ok: false })
    return
  }
  const result = await tool.execute(input) as { ok?: boolean }
  toolLog.value.unshift({ name: tool.name, input: JSON.stringify(input), output: typeof result === 'string' ? result : JSON.stringify(result, null, 2), ok: result?.ok !== false })
}

const syntax = computed(() => (tab.value === 'llms' && view.value ? llms(view.value.state) : ''))

function jump(pos: number) {
  view.value?.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
  view.value?.focus()
}
</script>

<template>
  <div class="h-[calc(100vh-var(--ui-header-height,64px))] grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_360px] min-h-0">
    <section class="min-h-0 flex flex-col border-r border-default">
      <div class="flex items-center gap-2 px-3 h-10 border-b border-default text-xs text-muted">
        <UBadge variant="subtle" label="source" size="sm" />
        <span v-pre>Type <kbd>/</kbd>, <kbd>::</kbd>, <kbd>{</kbd>, <kbd>{{</kbd>, <kbd>#</kbd>, <kbd>:</kbd> — or press <kbd>Ctrl</kbd>+<kbd>Space</kbd>. <kbd>→</kbd> drills in, <kbd>←</kbd> goes back.</span>
      </div>
      <ClientOnly>
        <ComarkCodeEditor v-model="doc" :options="DEMO_OPTIONS" height="100%" autofocus class="flex-1 min-h-0" @ready="onReady" />
      </ClientOnly>
    </section>
    <section class="min-h-0 flex flex-col border-r border-default">
      <div class="flex items-center gap-2 px-3 h-10 border-b border-default text-xs text-muted">
        <UBadge variant="subtle" label="preview" size="sm" color="neutral" />
        <span>rendered with <code>@comark/html</code></span>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <article class="comark-preview flex-1 min-h-0 overflow-auto p-6 prose prose-sm dark:prose-invert max-w-none" v-html="preview" />
    </section>
    <aside class="flex flex-col min-h-0 text-sm">
      <UTabs
        v-model="tab"
        :content="false"
        size="xs"
        class="px-2 pt-2"
        :items="[
          { label: 'Tour', value: 'tour' },
          { label: 'Agent', value: 'agent' },
          { label: `Problems (${diagnostics.length})`, value: 'problems' },
          { label: 'llms()', value: 'llms' },
        ]"
      />
      <ol v-if="tab === 'tour'" class="flex-1 overflow-auto p-3 space-y-1">
        <li v-for="step in TOUR" :key="step.title">
          <button class="w-full text-left rounded-md px-2 py-1.5 hover:bg-elevated" @click="tourStep(step.insert)">
            <span class="font-medium">{{ step.title }}</span>
            <code class="ml-2 text-xs text-primary">{{ step.trigger }}</code>
            <p class="text-xs text-muted" v-html="step.text.replace(/`([^`]+)`/g, '<code>$1</code>')" />
          </button>
        </li>
      </ol>
      <div v-else-if="tab === 'agent'" class="flex-1 min-h-0 flex flex-col gap-2 p-3">
        <USelect v-model="toolName" :items="tools.map(t => t.name)" size="sm" />
        <p class="text-xs text-muted">
          {{ selectedTool?.description }}
        </p>
        <UTextarea v-model="toolInput" :rows="6" class="font-mono" size="sm" />
        <UButton icon="i-lucide-play" label="Run" size="sm" @click="runTool" />
        <div class="flex-1 min-h-0 overflow-auto space-y-2">
          <div v-for="(entry, i) in toolLog" :key="i" class="rounded border border-default p-2 font-mono text-xs">
            <div :class="entry.ok ? 'text-success' : 'text-error'">
              {{ entry.name }} {{ entry.input }}
            </div>
            <pre class="whitespace-pre-wrap text-muted mt-1 max-h-60 overflow-auto">{{ entry.output }}</pre>
          </div>
        </div>
      </div>
      <ul v-else-if="tab === 'problems'" class="flex-1 overflow-auto p-3 space-y-2">
        <li v-for="(d, i) in diagnostics" :key="i">
          <button class="text-left" @click="jump(d.from)">
            <UBadge :color="d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info'" variant="subtle" size="sm" :label="d.source ?? d.severity" />
            <span class="ml-2">{{ d.message }}</span>
          </button>
        </li>
        <li v-if="!diagnostics.length" class="text-muted">
          No problems.
        </li>
      </ul>
      <pre v-else class="flex-1 overflow-auto p-3 text-xs whitespace-pre-wrap">{{ syntax }}</pre>
    </aside>
  </div>
</template>

<style>
/* minimal typography for the rendered preview */
.comark-preview > * + * { margin-top: 0.75em; }
.comark-preview h1 { font-size: 1.6em; font-weight: 700; }
.comark-preview h2 { font-size: 1.3em; font-weight: 600; }
.comark-preview h3 { font-size: 1.1em; font-weight: 600; }
.comark-preview ul { list-style: disc; padding-left: 1.4em; }
.comark-preview ol { list-style: decimal; padding-left: 1.4em; }
.comark-preview code { font-family: var(--font-mono, monospace); font-size: 0.9em; background: var(--ui-bg-elevated); border-radius: 4px; padding: 0 4px; }
.comark-preview pre { background: var(--ui-bg-elevated); border-radius: 8px; padding: 12px; overflow: auto; }
.comark-preview blockquote { border-left: 3px solid var(--ui-border-accented); padding-left: 12px; color: var(--ui-text-muted); }
.comark-preview a { color: var(--ui-primary); text-decoration: underline; }
/* the demo components, as plain HTML elements */
.comark-preview card { display: block; border: 1px solid var(--ui-border); border-radius: 10px; padding: 12px 16px; margin: 12px 0; }
.comark-preview card[title]::before { content: attr(title); display: block; font-weight: 600; margin-bottom: 4px; }
.comark-preview badge { display: inline-block; border-radius: 999px; padding: 0 8px; font-size: 0.8em; background: var(--ui-bg-elevated); border: 1px solid var(--ui-border); }
.comark-preview steps, .comark-preview for, .comark-preview if { display: block; }
</style>
