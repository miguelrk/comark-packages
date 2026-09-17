<script setup lang="ts">
import { defineComponent, h, ref, watch } from 'vue'
import type { PropType } from 'vue'
import { parseMarkdown } from 'comark'
import type { MarkdownDocument } from 'comark'
import type { ComarkModel } from 'comark-kv/model'
import binding, { Binding } from '@comark/nuxt/plugins/binding'
import kv from 'comark-kv'
import type { KvDescriptor, KvMeta, KvNamespaceMap, KvSchema } from 'comark-kv'
import { isSingleDriverSchema } from 'comark-kv'
import { createKvModel } from 'comark-kv/model'
import { bridgeModelForVue } from 'comark-kv/vue'

useHead({ title: 'Playground' })

const TODOS_URL = 'https://jsonplaceholder.typicode.com/todos'
const TODOS_LIST_URL = `${TODOS_URL}?_limit=5&_sort=id&_order=desc`

/**
 * Todo desk — three drivers, one document:
 * - config → browser (localStorage): name + dark/light preference
 * - draft  → memory: new-todo form fields (cleared on refresh)
 * - todos  → http shortcut: remote checklist
 */
const SAMPLE = `---
kv:
  config:
    driver: browser
    mount: user-config
    default:
      name: Ada
      dark: false
  draft:
    driver: memory
    mount: compose
    default:
      todo: ""
      completed: false
  todos: ${TODOS_LIST_URL}
---

# Todo desk

Hello **{{ kv.config.name }}**.

:input{::value="kv.config.name" placeholder="Your name"}

:input{::checked="kv.config.dark" type="checkbox"} Dark mode

Name and theme use the **browser** driver (localStorage) — reload and they stay.

## New todo

Draft fields use the **memory** driver. Submit POSTs to JSONPlaceholder and prepends the created item to the live checklist.

::form{::value="kv.draft" method="POST" url="${TODOS_URL}"}
  :input{::value="kv.draft.todo" name="title" placeholder="What needs doing?"}
  :input{::checked="kv.draft.completed" name="completed" type="checkbox"} Mark as completed
  ::button[Add todo]{type="submit"}
  ::
::

## Todos

Remote list via the **http** URL shortcut. Checkboxes update the model live.

:input{::checked="kv.todos.0.completed" type="checkbox"} {{ kv.todos.0.title }}

:input{::checked="kv.todos.1.completed" type="checkbox"} {{ kv.todos.1.title }}

:input{::checked="kv.todos.2.completed" type="checkbox"} {{ kv.todos.2.title }}

:input{::checked="kv.todos.3.completed" type="checkbox"} {{ kv.todos.3.title }}

:input{::checked="kv.todos.4.completed" type="checkbox"} {{ kv.todos.4.title }}
`

const markdown = ref(SAMPLE)
const debouncedMarkdown = ref(markdown.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(markdown, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debouncedMarkdown.value = value), 120)
})

const plugins = [kv(), binding()]
const tree = shallowRef<MarkdownDocument<KvMeta> | null>(null)
const model = shallowRef<ComarkModel | null>(null)
const modelKey = ref(0)
const status = ref('idle')
const submitStatus = ref('')

let disposeKv = () => {}
let loadGen = 0

/**
 * Form that honors method + url: POSTs draft fields to the API, then
 * prepends the created todo onto `kv.todos` and clears the draft.
 */
const TodoForm = defineComponent({
  name: 'Form',
  props: {
    value: { type: Object as PropType<Record<string, unknown> | undefined>, default: undefined },
    method: { type: String, default: 'POST' },
    url: { type: String, default: undefined },
    action: { type: String, default: undefined },
    'onUpdate:value': { type: Function as PropType<(v: Record<string, unknown>) => void>, default: undefined },
  },
  setup(props, { slots, attrs }) {
    const formRef = ref<HTMLFormElement | null>(null)
    const pending = ref(false)

    return () =>
      h(
        'form',
        {
          ...attrs,
          ref: formRef,
          method: props.method,
          action: props.url ?? props.action,
          onSubmit: async (e: Event) => {
            e.preventDefault()
            if (pending.value) return

            const formEl = formRef.value ?? (e.currentTarget as HTMLFormElement)
            const fd = new FormData(formEl)
            const aggregate = Object.fromEntries(fd.entries()) as Record<string, unknown>
            props['onUpdate:value']?.(aggregate)

            const endpoint = props.url ?? props.action
            const m = model.value
            if (!endpoint || !m) return

            const title = String(m.get('kv.draft.todo') ?? aggregate['title'] ?? '').trim()
            if (!title) {
              submitStatus.value = 'Enter a todo title'
              return
            }
            const completed = Boolean(m.get('kv.draft.completed') ?? aggregate['completed'])

            pending.value = true
            submitStatus.value = 'posting…'
            try {
              const res = await fetch(endpoint, {
                method: (props.method || 'POST').toUpperCase(),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, completed, userId: 1 }),
              })
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              const created = (await res.json()) as Record<string, unknown>
              const list = m.get('kv.todos')
              const next = Array.isArray(list) ? [created, ...list] : [created]
              m.set('kv.todos', next)
              m.set('kv.draft.todo', '')
              m.set('kv.draft.completed', false)
              submitStatus.value = `added “${title}”`
            } catch (err) {
              submitStatus.value =
                err instanceof Error ? err.message : 'submit failed'
            } finally {
              pending.value = false
            }
          },
        },
        slots.default?.(),
      )
  },
})

const components = { Binding, Form: TodoForm }

const schemaNeedsBrowser = (schema: KvSchema): boolean => {
  if (isSingleDriverSchema(schema)) {
    return schema.driver === 'browser' || schema.driver === 'localstorage'
  }
  return Object.values(schema).some(
    (d) => d.driver === 'browser' || d.driver === 'localstorage',
  )
}

const withDemoMounts = (schema: KvSchema): KvSchema => {
  if (isSingleDriverSchema(schema)) {
    if (schema.driver === 'browser' || schema.driver === 'localstorage') {
      return { ...schema, mount: `demo-${schema.mount}` }
    }
    return schema
  }
  const next: KvNamespaceMap = {}
  for (const [ns, desc] of Object.entries(schema)) {
    const d = desc as KvDescriptor
    next[ns] =
      d.driver === 'browser' || d.driver === 'localstorage'
        ? { ...d, mount: `demo-${d.mount}` }
        : d
  }
  return next
}

const applyTheme = (dark: unknown) => {
  if (!import.meta.client) return
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

const load = async (md: string) => {
  const gen = ++loadGen
  status.value = 'parsing'
  submitStatus.value = ''

  try {
    const doc = await parseMarkdown(md, { plugins })
    if (gen !== loadGen) return

    const schema = (doc.meta as KvMeta).kv as KvSchema | undefined
    tree.value = doc as MarkdownDocument<KvMeta>

    if (!schema) {
      disposeKv()
      disposeKv = () => {}
      model.value = null
      status.value = 'ready'
      return
    }

    if (schemaNeedsBrowser(schema) && !import.meta.client) {
      disposeKv()
      disposeKv = () => {}
      model.value = null
      status.value = 'client only'
      return
    }

    status.value = 'hydrating'
    const handle = await createKvModel(withDemoMounts(schema))
    await handle.ready
    if (gen !== loadGen) {
      handle.dispose()
      return
    }

    disposeKv()
    model.value = bridgeModelForVue(handle.model)
    modelKey.value += 1

    applyTheme(handle.model.get('kv.config.dark'))
    const offTheme = handle.model.subscribe('kv.config.dark', (dark) => {
      applyTheme(dark)
    })
    disposeKv = () => {
      offTheme()
      handle.dispose()
    }
    status.value = 'ready'
  } catch (err) {
    if (gen !== loadGen) return
    status.value = err instanceof Error ? err.message : 'parse error'
    tree.value = null
    model.value = null
  }
}

await load(debouncedMarkdown.value)

watch(debouncedMarkdown, (md) => {
  void load(md)
})

onUnmounted(() => {
  disposeKv()
  if (import.meta.client) delete document.documentElement.dataset.theme
})
</script>

<template>
  <main class="workbench">
    <section class="inputs">
      <label class="field">
        <span class="label">
          Markdown
          <small>browser · memory · http — todo desk</small>
        </span>
        <textarea v-model="markdown" rows="32" spellcheck="false" />
      </label>
    </section>

    <section class="output">
      <div class="toolbar" role="group" aria-label="Demo">
        <span class="status">{{ status }}</span>
        <span v-if="submitStatus" class="status tip">{{ submitStatus }}</span>
      </div>
      <div class="document prose">
        <Markdown
          v-if="tree && model"
          :key="modelKey"
          :value="tree"
          :model="model"
          :plugins="plugins"
          :components="components"
        />
        <p v-else-if="status === 'client only'" class="hint">
          Browser (localStorage) hydrates in the client — open this page in the browser.
        </p>
      </div>
    </section>
  </main>
</template>
