<script setup lang="ts">
import { withBase } from 'ufo'

defineProps<{
  alt: string
}>()

const { app: { baseURL } } = useRuntimeConfig()
const src = withBase('/og.png', baseURL)
</script>

<template>
  <img
    :src="src"
    :alt="alt"
    class="h-auto w-full max-w-full rounded-lg border border-default"
  >
</template>
