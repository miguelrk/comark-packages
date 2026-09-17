<script setup lang="ts">
import arrow, {
  ArrowSandbox,
  provideArrowHostBridge,
} from 'comark-arrow/vue'

useHead({ title: 'Playground' })

const streaming = ref(false)
const outputs = ref<unknown[]>([])
let idleTimer: ReturnType<typeof setTimeout> | undefined

const markdown = ref(`# Arrow in Markdown

Author live UI as fenced Arrow — Comark boots each block in \`@arrow-js/sandbox\` (QuickJS/WASM). No component registration.

## Reactive counter + CSS

\`\`\`arrow {height="72px"}
const state = reactive({ count: 0 })

export default html\`
  <button class="btn" @click="\${() => state.count++}">
    Clicked \${() => state.count}
  </button>
\`
\`\`\`

\`\`\`arrow-css
.btn {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1.5px solid #111;
  background: #f0db4f;
  cursor: pointer;
}
\`\`\`

## Computed values

Expression slots stay live when you pass a function. Change price or qty and the total updates.

\`\`\`arrow {height="96px"}
const props = reactive({ price: 25, quantity: 10 })

export default html\`
  <div class="row">
    <label>Price
      <input type="number" value="\${() => props.price}"
        @input="\${(e) => { props.price = Number(e.target.value) }}" />
    </label>
    <label>Qty
      <input type="number" value="\${() => props.quantity}"
        @input="\${(e) => { props.quantity = Number(e.target.value) }}" />
    </label>
    <strong>Total \${() => props.price * props.quantity}</strong>
  </div>
\`
\`\`\`

\`\`\`arrow-css
.row { display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap; }
label { display: grid; gap: 0.25rem; font-size: 12px; }
input { width: 5rem; font: inherit; padding: 0.35rem 0.5rem; }
\`\`\`

## Keyed list

Agents can ship interactive lists. Call \`.key(id)\` on components so identity survives edits.

\`\`\`arrow {height="180px"}
const data = reactive({
  text: '',
  todos: [
    { id: 1, text: 'Write docs', done: false },
    { id: 2, text: 'Ship widget', done: true },
  ],
})

const TodoItem = component((props) => html\`
  <li class="\${() => props.todo.done ? 'done' : ''}">
    <label>
      <input type="checkbox"
        checked="\${() => props.todo.done ? true : false}"
        @change="\${() => { props.todo.done = !props.todo.done }}" />
      \${() => props.todo.text}
    </label>
  </li>
\`)

const add = () => {
  const text = data.text.trim()
  if (!text) return
  data.todos = [...data.todos, { id: Date.now(), text, done: false }]
  data.text = ''
}

export default html\`
  <div class="todo">
    <form class="todo-add" @submit="\${(e) => { e.preventDefault(); add() }}">
      <input placeholder="Add a task" value="\${() => data.text}"
        @input="\${(e) => { data.text = e.target.value }}" />
      <button type="submit">Add</button>
    </form>
    <ul>
      \${() => data.todos.map((todo) => TodoItem({ todo }).key(todo.id))}
    </ul>
  </div>
\`
\`\`\`

\`\`\`arrow-css
.todo { display: grid; gap: 0.5rem; }
.todo-add { display: flex; gap: 0.5rem; }
.todo-add input { flex: 1; font: inherit; padding: 0.35rem 0.5rem; }
.todo-add button, .todo button { font: inherit; padding: 0.35rem 0.75rem; cursor: pointer; }
ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.25rem; }
.done { opacity: 0.55; text-decoration: line-through; }
label { display: flex; gap: 0.5rem; align-items: center; }
\`\`\`

## Components + local state

\`component()\` mounts once per slot — parent props stay live; local state survives parent updates.

\`\`\`arrow {height="88px"}
const parent = reactive({ count: 1 })

const Counter = component((props) => {
  const local = reactive({ clicks: 0 })
  return html\`<button class="btn" @click="\${() => local.clicks++}">
    Root \${() => props.count} · local \${() => local.clicks}
  </button>\`
})

export default html\`
  <div class="stack">
    <button class="link" @click="\${() => parent.count++}">Bump root</button>
    \${Counter(parent)}
  </div>
\`
\`\`\`

\`\`\`arrow-css
.stack { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.btn, .link {
  font: inherit; padding: 0.45rem 0.85rem; border-radius: 8px;
  border: 1.5px solid #111; cursor: pointer; background: #fff;
}
.btn { background: #f0db4f; }
.link { background: transparent; }
\`\`\`

## Host bridge

Sandbox code calls host APIs you allowlist — Markdown authors cannot widen the bridge.

\`\`\`arrow {height="100px"}
import { formatCount, getStockLevel } from 'host-bridge:demo'

const state = reactive({ count: 0, label: 'Count 0', stock: '…' })

void getStockLevel('SKU-42').then((n) => { state.stock = String(n) })

export default html\`
  <div class="stack">
    <button class="btn" @click="\${() => {
      state.count++
      Promise.resolve(formatCount(state.count)).then((label) => {
        state.label = String(label)
      })
    }}">
      \${() => state.label}
    </button>
    <p>Stock SKU-42: <strong>\${() => state.stock}</strong></p>
  </div>
\`
\`\`\`

\`\`\`arrow-css
.stack { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.btn {
  font: inherit; padding: 0.5rem 1rem; border-radius: 8px;
  border: 1.5px solid #111; background: #f0db4f; cursor: pointer;
}
p { margin: 0; }
\`\`\`

## \`output()\` → host

JSON-safe payloads cross the VM boundary. The playground logs them below.

\`\`\`arrow {height="72px"}
const state = reactive({ votes: 0 })

export default html\`
  <button class="btn" @click="\${() => {
    state.votes++
    output({ event: 'vote', votes: state.votes })
  }}">
    Vote (\${() => state.votes})
  </button>
\`
\`\`\`

\`\`\`arrow-css
.btn {
  font: inherit; padding: 0.5rem 1rem; border-radius: 8px;
  border: 1.5px solid #111; background: #111; color: #f0db4f; cursor: pointer;
}
\`\`\`

## Restricted fetch (weather)

Network uses the sandbox fetch proxy (https, no credentials) — not the page \`window\`. Cookies and DOM stay unreachable.

\`\`\`arrow {height="220px"}
const LOCATIONS = [
  { id: 'nyc', label: 'New York', latitude: 40.7128, longitude: -74.006 },
  { id: 'sf', label: 'San Francisco', latitude: 37.7749, longitude: -122.4194 },
  { id: 'den', label: 'Denver', latitude: 39.7392, longitude: -104.9903 },
]

const CODES = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 61: 'Rain', 71: 'Snow', 95: 'Thunder',
}

const state = reactive({
  selectedId: 'nyc',
  status: 'loading',
  summary: 'Fetching…',
  temperature: '—',
  wind: '—',
  error: '',
})

const location = () =>
  LOCATIONS.find((l) => l.id === state.selectedId) ?? LOCATIONS[0]

const load = async () => {
  const loc = location()
  state.status = 'loading'
  state.summary = 'Fetching…'
  state.error = ''
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + loc.latitude
      + '&longitude=' + loc.longitude
      + '&current=temperature_2m,weather_code,wind_speed_10m'
      + '&timezone=auto'
    const res = await fetch(url)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = await res.json()
    const cur = json.current ?? {}
    state.temperature = cur.temperature_2m == null ? '—' : cur.temperature_2m + '°'
    state.wind = cur.wind_speed_10m == null ? '—' : cur.wind_speed_10m + ' km/h'
    state.summary = CODES[cur.weather_code] ?? 'Ready'
    state.status = 'ready'
    output({ event: 'weather', place: loc.label, temp: state.temperature })
  } catch (err) {
    state.status = 'error'
    state.error = err instanceof Error ? err.message : String(err)
  }
}

void load()

export default html\`
  <section class="wx">
    <div class="bar">
      <select @change="\${(e) => {
        state.selectedId = e.target.value
        void load()
      }}">
        \${() => LOCATIONS.map((l) => html\`
          <option value="\${l.id}" selected="\${() => state.selectedId === l.id}">
            \${l.label}
          </option>
        \`)}
      </select>
      <button @click="\${() => void load()}">Refresh</button>
    </div>
    \${() => state.status === 'error'
      ? html\`<p class="err">\${() => state.error}</p>\`
      : html\`<article>
          <p class="place">\${() => location().label}</p>
          <h3>\${() => state.temperature}</h3>
          <p>\${() => state.summary} · wind \${() => state.wind}</p>
        </article>\`
    }
  </section>
\`
\`\`\`

\`\`\`arrow-css
.wx { display: grid; gap: 0.75rem; }
.bar { display: flex; gap: 0.5rem; }
select, button { font: inherit; padding: 0.35rem 0.6rem; }
article { padding: 0.75rem 1rem; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; }
.place { margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }
h3 { margin: 0.15rem 0; font-size: 1.75rem; }
p { margin: 0; }
.err { color: #c33; }
\`\`\`
`)

const debouncedMarkdown = ref(markdown.value)

watch(markdown, (value) => {
  streaming.value = true
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    debouncedMarkdown.value = value
    streaming.value = false
  }, 120)
})

provideArrowHostBridge({
  'host-bridge:demo': {
    formatCount: (count: unknown) => `Count ${String(count)}`,
    getStockLevel: async (_sku: unknown) => 128,
  },
})

const PlayArrowSandbox = defineComponent({
  name: 'PlayArrowSandbox',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () =>
      h(ArrowSandbox, {
        ...attrs,
        onOutput: (payload: unknown) => {
          outputs.value = [...outputs.value.slice(-11), payload]
        },
      })
  },
})

const plugins = [arrow({ streaming: () => streaming.value })]

const formatOutput = (payload: unknown) => {
  try {
    return JSON.stringify(payload)
  } catch {
    return String(payload)
  }
}
</script>

<template>
  <main class="workbench">
    <section class="inputs">
      <label class="field">
        <span class="label">Markdown <small>arrow plugin</small></span>
        <textarea
          v-model="markdown"
          rows="40"
          spellcheck="false"
        />
      </label>
    </section>

    <section class="output">
      <div
        class="toolbar"
        role="group"
        aria-label="Output"
      >
        <span class="status">{{ streaming ? 'streaming' : 'preview' }}</span>
        <span
          v-if="outputs.length"
          class="status"
        >output {{ outputs.length }}</span>
      </div>
      <div class="document prose">
        <Markdown
          :value="debouncedMarkdown"
          :plugins="plugins"
          :components="{ ArrowSandbox: PlayArrowSandbox }"
          :streaming="streaming"
        />
      </div>
      <aside
        v-if="outputs.length"
        class="output-log"
        aria-label="Sandbox output()"
      >
        <h2 class="output-log-title">
          <code>output()</code> from widgets
        </h2>
        <ol>
          <li
            v-for="(item, i) in outputs"
            :key="i"
          >
            <code>{{ formatOutput(item) }}</code>
          </li>
        </ol>
      </aside>
    </section>
  </main>
</template>
