<script setup lang="ts">
useHead({ title: 'Playground — comark-email' })

interface RenderResult {
  html: string
  subject?: string
  previewText?: string
  errors: Array<{ message: string; line?: number; tagName?: string }>
}

const DEFAULT_MARKDOWN = `---
email:
  subject: "Your order has shipped!"
  previewText: "Track your package delivery status."
  brandColor: "#0066cc"
  theme:
    primary: "#0066cc"
    background: "#f4f5f7"
---

# Order Shipped

Your order is on its way.

::email-button{href="https://example.com/track" background-color="#0066cc" color="#ffffff"}
Track Package
::

---

## What's next

::email-columns
Left column content.

Right column content.
::

::email-divider{border-color="#cccccc"}
::

A final paragraph to confirm rendering.
`

const markdown = ref(DEFAULT_MARKDOWN)
const result = ref<RenderResult | null>(null)
const isLoading = ref(false)
const renderError = ref<string | null>(null)

// Stale-response guard: each render increments the generation counter.
// The handler ignores the response when the generation doesn't match.
let generation = 0
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const doRender = async (md: string) => {
  const gen = ++generation
  isLoading.value = true
  renderError.value = null
  try {
    const data = await $fetch<RenderResult>('/api/render', {
      method: 'POST',
      body: { markdown: md },
    })
    if (gen !== generation) return
    result.value = data
  } catch (err) {
    if (gen !== generation) return
    renderError.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (gen === generation) isLoading.value = false
  }
}

watch(
  markdown,
  (value) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => doRender(value), 150)
  },
  { immediate: true }
)
</script>

<template>
  <main class="workbench">
    <section class="inputs">
      <label class="field">
        <span class="label">Markdown</span>
        <textarea v-model="markdown" rows="32" spellcheck="false" />
      </label>
    </section>

    <section class="output">
      <div class="toolbar" role="group" aria-label="Output">
        <span v-if="result?.subject" class="meta-item">
          <b>Subject:</b> {{ result.subject }}
        </span>
        <span v-if="result?.previewText" class="meta-item">
          <b>Preview:</b> {{ result.previewText }}
        </span>
        <span v-if="isLoading" class="status">rendering…</span>
      </div>

      <ul v-if="result?.errors?.length" class="error-list">
        <li v-for="(e, i) in result.errors" :key="i" class="error-item">
          <b v-if="e.tagName">{{ e.tagName }}</b>
          {{ e.message }}
          <span v-if="e.line"> (line {{ e.line }})</span>
        </li>
      </ul>
      <div v-if="renderError" class="error-item">{{ renderError }}</div>

      <iframe
        v-if="result?.html"
        :srcdoc="result.html"
        sandbox="allow-same-origin"
        class="email-preview"
        title="Email preview"
      />
    </section>
  </main>
</template>

<style scoped>
.meta-item {
  font-size: 0.85rem;
  margin-right: 1rem;
  opacity: 0.75;
}
.error-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.error-item {
  background: #ffeaea;
  border-left: 3px solid #c00;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}
.email-preview {
  border: none;
  width: 100%;
  flex: 1;
  min-height: 500px;
}
</style>
