<script setup lang="ts">
import rangi from '@comark/nuxt/plugins/rangi'
import readmeRaw from '../../../README.md?raw'

useHead({ title: 'Docs' })

const baseURL = useRuntimeConfig().app.baseURL || '/'
const readme = readmeRaw.replaceAll(
  '(playground/public/og.png)',
  `(${baseURL}og.png)`,
)

const plugins = [rangi()]
</script>

<template>
  <main class="docs">
    <article class="prose">
      <Markdown
        :value="readme"
        :plugins="plugins"
      />
    </article>
  </main>
</template>
