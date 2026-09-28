<script setup lang="ts">
/**
 * A CodeMirror editor with `comark()` — the ten lines a host writes, plus
 * `v-model` and the site's color mode.
 */
import type { ComarkOptions } from 'comark-codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { comark } from 'comark-codemirror'

const props = withDefaults(defineProps<{
  options?: ComarkOptions
  height?: string
  autofocus?: boolean
}>(), { options: () => ({}), height: '320px', autofocus: false })

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ ready: [view: EditorView] }>()

const el = ref<HTMLElement>()
const colorMode = useColorMode()
const scheme = new Compartment()
const light = EditorView.theme({ '&': { backgroundColor: 'transparent' } })
const themeFor = (mode: string) => (mode === 'dark' ? [oneDark, EditorView.theme({ '&': { backgroundColor: 'transparent' }, '.cm-gutters': { backgroundColor: 'transparent' } }, { dark: true })] : light)

let view: EditorView | undefined

onMounted(() => {
  view = new EditorView({
    parent: el.value!,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        basicSetup,
        EditorView.lineWrapping,
        comark(props.options),
        scheme.of(themeFor(colorMode.value)),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, monospace)', lineHeight: '1.6' },
          '&.cm-focused': { outline: 'none' },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) model.value = update.state.doc.toString()
        }),
      ],
    }),
  })
  if (props.autofocus) view.focus()
  emit('ready', view)
})

watch(() => colorMode.value, mode => view?.dispatch({ effects: scheme.reconfigure(themeFor(mode)) }))
watch(model, (value) => {
  if (view && value !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})
onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="el" class="comark-code-editor" :style="{ height }" />
</template>
