<script setup lang="ts">
import binding, { Binding } from '@comark/nuxt/plugins/binding'
import fetchPlugin from 'comark-fetch'

useHead({ title: 'Playground' })

const markdown = ref(`---
fetch:
  posts: https://jsonplaceholder.typicode.com/posts?_limit=5
---

# Fetch Plugin

Frontmatter \`fetch:\` entries resolve at parse time into \`meta.fetch\`.

## Posts (\`meta.fetch.posts\`)

Loaded **{{ meta.fetch.posts.length }}** posts.

| id | title |
| -- | ----- |
| {{ meta.fetch.posts.0.id }} | {{ meta.fetch.posts.0.title }} |
| {{ meta.fetch.posts.1.id }} | {{ meta.fetch.posts.1.title }} |
| {{ meta.fetch.posts.2.id }} | {{ meta.fetch.posts.2.title }} |
`)

const debouncedMarkdown = ref(markdown.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(markdown, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debouncedMarkdown.value = value), 120)
})

const plugins = [
  fetchPlugin({
    allowOrigins: ['https://jsonplaceholder.typicode.com'],
  }),
  binding(),
]
</script>

<template>
  <main class="workbench">
    <section class="inputs">
      <label class="field">
        <span class="label">Markdown <small>fetch: frontmatter + bindings</small></span>
        <textarea v-model="markdown" rows="32" spellcheck="false" />
      </label>
    </section>

    <section class="output">
      <div class="toolbar" role="group" aria-label="Output">
        <span class="status">preview</span>
      </div>
      <div class="document prose">
        <Markdown
          :value="debouncedMarkdown"
          :plugins="plugins"
          :components="{ Binding }"
        />
      </div>
    </section>
  </main>
</template>
