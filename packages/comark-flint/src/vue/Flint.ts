import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue'

export type FlintBackendProp = 'vegalite' | 'echarts' | 'chartjs' | 'plotly' | 'excel' | string

export interface FlintProps {
  /** Compiled backend-native chart spec (from the plugin), or a raw object. */
  spec?: Record<string, unknown>
  /** Rendering backend. @default 'vegalite' */
  backend?: FlintBackendProp
  /** Chart canvas width in pixels. @default 400 */
  width?: number | string
  /** Chart canvas height in pixels. @default 300 */
  height?: number | string
  /** Flint theme preset name (informational; already applied at compile time). */
  theme?: string | Record<string, unknown>
  /** Original Flint ChartAssemblyInput (optional debug/passthrough). */
  input?: Record<string, unknown>
  class?: string
}

type VegaEmbedResult = { finalize: () => void }
type EChartsInstance = { setOption: (o: unknown) => void; dispose: () => void }

const toPlainSpec = (spec: unknown): Record<string, unknown> => {
  const cloned = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>
  for (const key of Object.keys(cloned)) {
    if (key.startsWith('_')) delete cloned[key]
  }
  return cloned
}

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback

/**
 * Vue renderer for `<Flint>` AST nodes emitted by `comark-flint`.
 *
 * Register alongside the plugin:
 * ```ts
 * import flint, { Flint } from 'comark-flint/vue'
 * // <Markdown :plugins="[flint()]" :components="{ Flint }" />
 * ```
 *
 * Soft-fails into a visible error UI — never throws into the page tree.
 */
export const Flint = defineComponent({
  name: 'Flint',
  props: {
    spec: {
      type: Object as PropType<Record<string, unknown>>,
      default: undefined,
    },
    backend: { type: String as PropType<FlintBackendProp>, default: 'vegalite' },
    width: { type: [Number, String] as PropType<number | string>, default: 400 },
    height: { type: [Number, String] as PropType<number | string>, default: 300 },
    theme: {
      type: [String, Object] as PropType<string | Record<string, unknown>>,
      default: undefined,
    },
    input: {
      type: Object as PropType<Record<string, unknown>>,
      default: undefined,
    },
    class: { type: String, default: '' },
  },
  setup(props) {
    const el = ref<HTMLDivElement | null>(null)
    const error = ref<string | null>(null)
    let chart: EChartsInstance | null = null
    let view: VegaEmbedResult | null = null
    let renderId = 0

    const cleanup = () => {
      view?.finalize()
      view = null
      chart?.dispose()
      chart = null
      if (el.value) el.value.innerHTML = ''
    }

    const render = async () => {
      if (!el.value) return
      const id = ++renderId
      error.value = null
      cleanup()

      if (props.spec == null) {
        error.value = 'Missing chart spec'
        return
      }

      const width = Number(props.width) || 400
      const height = Number(props.height) || 300
      let spec: Record<string, unknown>
      try {
        spec = toPlainSpec(props.spec)
      } catch (err) {
        error.value = errorMessage(err, 'Invalid chart spec')
        return
      }

      try {
        if (props.backend === 'echarts') {
          const echarts = await import('echarts')
          if (id !== renderId) return
          chart = echarts.init(el.value, undefined, {
            width,
            height,
            renderer: 'svg',
          }) as EChartsInstance
          chart.setOption(spec)
          return
        }

        if (
          props.backend === 'chartjs' ||
          props.backend === 'plotly' ||
          props.backend === 'excel'
        ) {
          error.value =
            `Backend "${props.backend}" is not supported by the Vue Flint renderer yet. ` +
            'Use backend="vegalite" or backend="echarts".'
          return
        }

        const { default: embed } = await import('vega-embed')
        if (id !== renderId) return
        const result = (await embed(el.value, spec, {
          actions: false,
          ...(typeof spec.width === 'object' ? {} : { width }),
          height,
        })) as VegaEmbedResult
        if (id !== renderId) {
          result.finalize()
          return
        }
        view = result
      } catch (err) {
        if (id !== renderId) return
        cleanup()
        error.value = errorMessage(err, 'Failed to render chart')
      }
    }

    onMounted(() => {
      void render()
    })

    watch(
      () => [props.spec, props.backend, props.width, props.height] as const,
      () => {
        void render()
      },
    )

    onBeforeUnmount(cleanup)

    return () =>
      h('div', { class: ['flint', props.class].filter(Boolean).join(' ') }, [
        error.value
          ? h(
              'div',
              { class: 'flint-error', role: 'alert' },
              `[flint error] ${error.value}`,
            )
          : null,
        h('div', {
          ref: el,
          class: 'flint-chart',
          style: error.value ? { display: 'none' } : undefined,
        }),
      ])
  },
})

export default Flint
