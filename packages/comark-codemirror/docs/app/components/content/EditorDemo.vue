<script setup lang="ts">
import { DEMO_OPTIONS, DEMOS } from '~/utils/demos'

const props = withDefaults(defineProps<{
  /** Key of a demo document in `utils/demos.ts`. */
  demo?: string
  height?: string
}>(), { demo: 'tour', height: '320px' })

const value = ref(DEMOS[props.demo] ?? '')
</script>

<template>
  <div class="not-prose my-6 rounded-lg border border-default overflow-hidden bg-default">
    <ClientOnly>
      <ComarkCodeEditor v-model="value" :options="DEMO_OPTIONS" :height="height" />
      <template #fallback>
        <pre class="p-4 text-sm" :style="{ height }">{{ value }}</pre>
      </template>
    </ClientOnly>
  </div>
</template>
