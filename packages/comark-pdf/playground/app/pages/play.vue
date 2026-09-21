<script setup lang="ts">
import { createPdfRenderer } from 'comark-pdf'
import { mount, type PdfMountHandle } from 'comark-pdf/preview'
import { examples, type DemoExample } from '../examples/index.ts'

useHead({ title: 'Playground' })

const active = ref<DemoExample>(examples[0]!)
const markdown = ref(active.value.markdown)
const error = ref<string | null>(null)
const status = ref('Ready')
const previewRef = ref<HTMLDivElement | null>(null)

let handle: PdfMountHandle | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

const createRenderer = (example: DemoExample) =>
  createPdfRenderer({
    plugins: example.plugins,
    components: example.components,
    visuals: example.visuals,
    data: example.data,
  })

let renderPdf = createRenderer(active.value)

const renderPreview = async (md: string) => {
  if (!previewRef.value) return
  const current = ++generation
  error.value = null
  status.value = 'Rendering…'
  try {
    const bytes = await renderPdf(md)
    if (current !== generation) return
    handle?.revoke()
    handle = mount(previewRef.value, bytes)
    status.value = 'Ready'
  } catch (err) {
    if (current !== generation) return
    status.value = 'Error'
    error.value = err instanceof Error ? err.message : String(err)
  }
}

const selectExample = (example: DemoExample) => {
  active.value = example
  renderPdf = createRenderer(example)
  markdown.value = example.markdown
  void renderPreview(example.markdown)
}

watch(markdown, (md) => {
  clearTimeout(timer)
  timer = setTimeout(() => renderPreview(md), 300)
})

onMounted(() => renderPreview(markdown.value))
onUnmounted(() => {
  clearTimeout(timer)
  handle?.revoke()
})
</script>

<template>
  <main class="workbench">
    <section class="inputs">
      <div class="example-tabs" role="tablist" aria-label="Examples">
        <button
          v-for="example in examples"
          :key="example.id"
          type="button"
          role="tab"
          :aria-selected="active.id === example.id"
          :aria-pressed="active.id === example.id"
          @click="selectExample(example)"
        >
          {{ example.label }}
        </button>
      </div>
      <label class="field">
        <span class="label">Markdown</span>
        <textarea v-model="markdown" rows="32" spellcheck="false" />
      </label>
    </section>

    <section class="output">
      <div class="toolbar" role="group" aria-label="Output">
        <span class="status" :class="{ error: status === 'Error' }">{{ status }}</span>
      </div>
      <div class="preview-pane">
        <div v-if="error" class="error">{{ error }}</div>
        <div ref="previewRef" class="preview-frame" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.example-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.example-tabs button {
  padding: 0.4rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}
.example-tabs button[aria-pressed='true'] {
  color: var(--fg);
  background: var(--surface);
  border-color: var(--border);
}
.preview-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.preview-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
}
.error {
  padding: 0.75rem 1rem;
  background: var(--error, #c33);
  color: #fff;
  font-size: 0.875rem;
  white-space: pre-wrap;
}
</style>
