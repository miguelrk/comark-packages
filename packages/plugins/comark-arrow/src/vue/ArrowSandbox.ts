import {
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
  type InjectionKey,
  type PropType,
  type Ref,
} from 'vue'
import type { ArrowFallback, ArrowStatus } from '../index.ts'

export type HostBridgeFn = (...args: unknown[]) => unknown | Promise<unknown>
export type HostBridgeModule = Record<string, HostBridgeFn>
export type HostBridge = Record<string, HostBridgeModule>

export const ARROW_HOST_BRIDGE_KEY: InjectionKey<HostBridge | Ref<HostBridge>> =
  Symbol('comark-arrow-host-bridge')

/**
 * Provide a hostBridge allowlist to descendant `<ArrowSandbox>` components.
 * Must be called from a parent setup() — never derived from document content.
 */
export const provideArrowHostBridge = (bridge: HostBridge | Ref<HostBridge>) => {
  provide(ARROW_HOST_BRIDGE_KEY, bridge)
}

export interface ArrowSandboxProps {
  source?: string
  css?: string
  status?: ArrowStatus
  height?: string
  shadowDom?: boolean
  debug?: boolean
  fallback?: ArrowFallback
  hostBridge?: HostBridge
  class?: string
}

type SandboxMount = (el: HTMLElement) => unknown

const buildSignature = (
  source: string,
  css: string | undefined,
  shadowDom: boolean,
  debug: boolean,
): string =>
  JSON.stringify([debug, shadowDom, source, css ?? ''])

const resolveBridge = (
  prop: HostBridge | undefined,
  injected: HostBridge | Ref<HostBridge> | undefined,
): HostBridge | undefined => {
  if (prop) return prop
  if (!injected) return undefined
  return typeof injected === 'object' && injected !== null && 'value' in injected
    ? (injected as Ref<HostBridge>).value
    : (injected as HostBridge)
}

/**
 * Vue renderer for `['ArrowSandbox', attrs]` AST nodes from `comark-arrow`.
 *
 * ```ts
 * import arrow, { ArrowSandbox, provideArrowHostBridge } from 'comark-arrow/vue'
 * // <Markdown :plugins="[arrow()]" :components="{ ArrowSandbox }" />
 * ```
 *
 * Boots `@arrow-js/sandbox` only when `status === 'ready'` and only after mount
 * (SSR-safe). Soft-fails into an inline error UI — never throws into the tree.
 */
export const ArrowSandbox = defineComponent({
  name: 'ArrowSandbox',
  props: {
    source: { type: String, default: undefined },
    css: { type: String, default: undefined },
    status: {
      type: String as PropType<ArrowStatus>,
      default: 'ready',
    },
    height: { type: String, default: undefined },
    shadowDom: { type: Boolean, default: true },
    debug: { type: Boolean, default: false },
    fallback: {
      type: String as PropType<ArrowFallback>,
      default: 'caption',
    },
    hostBridge: {
      type: Object as PropType<HostBridge>,
      default: undefined,
    },
    class: { type: String, default: '' },
  },
  emits: {
    output: (_payload: unknown) => true,
    error: (_error: string) => true,
  },
  setup(props, { emit }) {
    const host = ref<HTMLDivElement | null>(null)
    const error = ref<string | null>(null)
    const injected = inject(ARROW_HOST_BRIDGE_KEY, undefined)
    let renderId = 0
    let lastSignature = ''
    let mounted = false

    const cleanup = () => {
      if (host.value) host.value.innerHTML = ''
      lastSignature = ''
    }

    const render = async () => {
      if (!mounted || !host.value) return
      const id = ++renderId
      error.value = null

      if (props.status === 'pending') {
        cleanup()
        return
      }

      const source = props.source ?? ''
      if (!source) {
        cleanup()
        error.value = 'Missing Arrow source'
        return
      }

      const shadowDom = props.shadowDom !== false
      const signature = buildSignature(source, props.css, shadowDom, props.debug)
      if (signature === lastSignature && host.value.childNodes.length > 0) {
        return
      }

      cleanup()
      lastSignature = signature

      try {
        const { sandbox } = await import('@arrow-js/sandbox')
        if (id !== renderId || !host.value) return

        const files: Record<string, string> = { 'main.ts': source }
        if (props.css) files['main.css'] = props.css

        const bridge = resolveBridge(props.hostBridge, injected)
        const view = sandbox(
          {
            source: files,
            shadowDOM: shadowDom,
            debug: props.debug,
            onError: (err) => {
              const msg = typeof err === 'string' ? err : err.message
              error.value = msg
              emit('error', msg)
            },
          },
          {
            output: (payload) => emit('output', payload),
          },
          bridge,
        )

        if (id !== renderId || !host.value) return
        ;(view as SandboxMount)(host.value)
      } catch (err) {
        if (id !== renderId) return
        cleanup()
        const msg = err instanceof Error ? err.message : 'Failed to boot Arrow sandbox'
        error.value = msg
        emit('error', msg)
      }
    }

    onMounted(() => {
      mounted = true
      void render()
    })

    watch(
      () =>
        [
          props.source,
          props.css,
          props.status,
          props.shadowDom,
          props.debug,
          props.hostBridge,
        ] as const,
      () => {
        void render()
      },
    )

    onBeforeUnmount(() => {
      mounted = false
      cleanup()
    })

    return () => {
      const height = props.height
      const pending = props.status === 'pending'

      return h(
        'div',
        {
          class: ['arrow-sandbox', props.class].filter(Boolean).join(' '),
          style: height ? { minHeight: height } : undefined,
          'data-status': props.status,
        },
        [
          pending
            ? h(
                'div',
                { class: 'arrow-sandbox-pending', 'aria-busy': 'true' },
                [
                  h('pre', { class: 'arrow-sandbox-preview' }, props.source ?? ''),
                ],
              )
            : null,
          error.value
            ? h(
                'div',
                { class: 'arrow-sandbox-error', role: 'alert' },
                `[arrow error] ${error.value}`,
              )
            : null,
          h('div', {
            ref: host,
            class: 'arrow-sandbox-host',
            style:
              pending || error.value
                ? { display: 'none' }
                : height
                  ? { minHeight: height }
                  : undefined,
          }),
        ],
      )
    }
  },
})

export default ArrowSandbox
