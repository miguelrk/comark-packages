/**
 * Vue composable that builds a live {@link ComarkModel} from `tree.meta.kv`.
 *
 * Supports both single-driver and multi-driver {@link KvSchema} forms.
 *
 * **Single-driver:**
 * ```vue
 * <script setup>
 * import { parseMarkdown } from 'comark'
 * import kv from 'comark-kv'
 * import { useKvModel } from 'comark-kv/vue'
 *
 * const tree = await parseMarkdown(md, { plugins: [kv()] })
 * const { model, ready } = useKvModel(tree)
 * await ready
 * </script>
 *
 * <template>
 *   <Markdown :value="tree" :model="model" />
 * </template>
 * ```
 *
 * **Multi-driver:**
 * ```vue
 * <!-- frontmatter: kv: { local: { driver, mount, default } } -->
 * <!-- model paths: kv.local.name, kv.session.draft -->
 * ```
 */

import type { MarkdownDocument } from 'comark'
import type { ComarkModel } from '../model/store.ts'
import { onUnmounted, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { createKvModel } from '../model/index.ts'
import type { CreateKvModelOptions, KvModelHandle } from '../model/index.ts'
import type { KvMeta, KvSchema } from '../types.ts'
import { isSingleDriverSchema } from '../types.ts'

export interface UseKvModelOptions extends CreateKvModelOptions {
  /**
   * When false, skip `onUnmounted` dispose (caller owns the lifecycle).
   * @default true
   */
  autoDispose?: boolean
}

export interface UseKvModelResult {
  /** Populated once `createKvModel` resolves; null until then / when no kv. */
  model: ShallowRef<ComarkModel | null>
  /** Resolves when the model exists and hydration finished (or immediately if no kv). */
  ready: Promise<void>
  dispose: () => void
  /** Underlying handle once created. */
  handle: ShallowRef<KvModelHandle | null>
}

const KV_NAMESPACE = 'kv'

/**
 * Bridge a kv model for `@comark/vue` MarkdownDocument.
 *
 * MarkdownDocument currently `subscribe()`s only to the `data` namespace for
 * re-renders. This wrapper also notifies those listeners on `kv` writes so
 * `{{ kv.* }}` and controlled inputs update live.
 */
export const bridgeModelForVue = (model: ComarkModel): ComarkModel => ({
  get: (path) => model.get(path),
  set: (path, value) => model.set(path, value),
  subscribe: (path, fn) => {
    if (path === 'data') {
      const offData = model.subscribe('data', fn)
      const offKv = model.subscribe(KV_NAMESPACE, fn)
      return () => {
        offData()
        offKv()
      }
    }
    return model.subscribe(path, fn)
  },
  batch: model.batch ? ((fn) => model.batch!(fn)) : undefined,
})

const resolveSchema = (
  input: MarkdownDocument<KvMeta> | KvSchema | null | undefined,
): KvSchema | null => {
  if (!input) return null

  // Raw KvDescriptor (single-driver passed directly)
  if (isSingleDriverSchema(input as KvSchema)) {
    return input as KvSchema
  }

  // KvNamespaceMap passed directly — every value is a plain object without `meta`
  const asObj = input as Record<string, unknown>
  if (
    typeof asObj['meta'] === 'undefined' &&
    typeof asObj['driver'] === 'undefined' &&
    Object.values(asObj).every((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
  ) {
    return input as KvSchema
  }

  // MarkdownDocument
  const tree = input as MarkdownDocument<KvMeta>
  return tree.meta?.['kv'] ?? null
}

/**
 * Create and hydrate a kv-backed {@link ComarkModel} for a parsed document
 * (or a raw {@link KvSchema}). Disposes on unmount by default.
 */
export const useKvModel = (
  input:
    | MarkdownDocument<KvMeta>
    | KvSchema
    | Ref<MarkdownDocument<KvMeta> | KvSchema | null | undefined>
    | null
    | undefined,
  options: UseKvModelOptions = {},
): UseKvModelResult => {
  const { autoDispose = true, ...createOpts } = options
  const model = shallowRef<ComarkModel | null>(null)
  const handle = shallowRef<KvModelHandle | null>(null)
  let disposed = false

  const dispose = () => {
    if (disposed) return
    disposed = true
    handle.value?.dispose()
    handle.value = null
    model.value = null
  }

  const ready = (async () => {
    const raw = input && typeof input === 'object' && 'value' in input ? input.value : input
    const schema = resolveSchema(raw as MarkdownDocument<KvMeta> | KvSchema | null)
    if (!schema) return
    if (disposed) return

    const h = await createKvModel(schema, createOpts)
    if (disposed) {
      h.dispose()
      return
    }
    handle.value = h
    model.value = bridgeModelForVue(h.model)
    await h.ready
  })()

  if (autoDispose) {
    onUnmounted(dispose)
  }

  return { model, ready, dispose, handle }
}
