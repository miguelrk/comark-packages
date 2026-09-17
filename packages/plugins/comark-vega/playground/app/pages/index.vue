<script setup lang="ts">
// The docs are the repository README, rendered by Comark itself.
import readmeRaw from '../../../README.md?raw'

useHead({ title: 'Docs' })

const baseURL = useRuntimeConfig().app.baseURL || '/'
const readme = readmeRaw.replaceAll(
  '(playground/public/og.png)',
  `(${baseURL}og.png)`,
)
</script>

<template>
  <main class="docs">
    <article class="prose">
      <Markdown :value="readme" />
    </article>
  </main>
</template>
