import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { PropType } from 'vue'
import type { ChartEngine, VegaOutput } from '../index.ts'
import { mountVegaView } from '../mountView.ts'
import type { MountedVegaView } from '../mountView.ts'

const toNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v !== '') {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return undefined
}

/** Vega cannot structured-clone Vue reactive proxies — pass a plain object. */
const plainSpec = (spec: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(toRaw(spec))) as Record<string, unknown>

/**
 * Vue renderer for `['Vega', attrs]` AST nodes produced by the vega plugin.
 *
 * Register alongside the plugin:
 * ```ts
 * import vega, { Vega } from 'comark-vega/vue'
 * // <Markdown :plugins="[vega()]" :components="{ Vega }" />
 * ```
 */
export const Vega = defineComponent({
  name: 'Vega',
  props: {
    spec: {
      type: Object as PropType<Record<string, unknown>>,
      default: undefined,
    },
    engine: {
      type: String as PropType<ChartEngine>,
      default: undefined,
    },
    width: {
      type: [Number, String] as PropType<number | string>,
      default: undefined,
    },
    height: {
      type: [Number, String] as PropType<number | string>,
      default: undefined,
    },
    output: {
      type: String as PropType<VegaOutput>,
      default: undefined,
    },
    class: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const container = ref<HTMLElement | null>(null)
    const error = ref<string | null>(null)
    let mounted: MountedVegaView | null = null
    let host: HTMLElement | null = null
    let renderId = 0

    const teardown = () => {
      mounted?.finalize()
      mounted = null
      host?.remove()
      host = null
    }

    const render = async () => {
      const id = ++renderId
      const spec = props.spec

      if (!spec) {
        teardown()
        error.value = null
        return
      }

      await nextTick()
      const el = container.value
      if (!el || id !== renderId) return

      // Mount into a per-generation host so a stale async mount can finalize
      // without wiping a newer view that already owns the container.
      teardown()
      const nextHost = document.createElement('div')
      nextHost.className = 'vega-chart-host'
      el.appendChild(nextHost)
      host = nextHost
      error.value = null

      try {
        const next = await mountVegaView(nextHost, {
          spec: plainSpec(spec),
          engine: props.engine,
          width: toNumber(props.width),
          height: toNumber(props.height),
        })
        if (id !== renderId) {
          next.finalize()
          nextHost.remove()
          return
        }
        mounted = next
        host = nextHost
      } catch (err) {
        if (id !== renderId) {
          nextHost.remove()
          return
        }
        teardown()
        error.value = err instanceof Error ? err.message : 'Failed to render Vega chart'
      }
    }

    onMounted(() => {
      void render()
    })

    watch(
      () =>
        JSON.stringify({
          spec: props.spec ?? null,
          engine: props.engine ?? null,
          width: props.width ?? null,
          height: props.height ?? null,
        }),
      () => {
        void render()
      },
    )

    onBeforeUnmount(() => {
      renderId += 1
      teardown()
    })

    return () => {
      const width = toNumber(props.width)
      const height = toNumber(props.height)
      void props.output

      return h('div', { class: `vega ${props.class}`.trim() }, [
        error.value
          ? h('pre', { class: 'vega-error' }, [h('code', error.value)])
          : null,
        h('div', {
          ref: container,
          class: 'vega-chart',
          style: {
            display: error.value ? 'none' : undefined,
            width: width != null ? `${width}px` : '100%',
            height: height != null ? `${height}px` : 'auto',
          },
        }),
      ])
    }
  },
})
