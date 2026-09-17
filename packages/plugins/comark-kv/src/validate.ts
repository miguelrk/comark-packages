import type { KvDescriptor, KvSchema } from './types.ts'
import { isSingleDriverSchema } from './types.ts'

export interface ValidateKvResult {
  ok: boolean
  errors: Record<string, string>
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const validateSingle = (desc: KvDescriptor, prefix = ''): Record<string, string> => {
  const errors: Record<string, string> = {}
  const k = (field: string) => (prefix ? `${prefix}.${field}` : field)

  if (!desc.driver || typeof desc.driver !== 'string') {
    errors[k('driver')] = 'driver is required'
  }

  if (typeof desc.mount !== 'string' || desc.mount.length === 0) {
    errors[k('mount')] = 'mount must be a non-empty string'
  }

  if (desc.driver === 'http') {
    if (typeof desc.base !== 'string' || desc.base.length === 0) {
      errors[k('base')] = 'base is required when driver is "http"'
    }
  }

  if (desc.resource === true && desc.driver !== 'http') {
    errors[k('resource')] = 'resource: true requires driver "http"'
  }

  if (desc.default !== undefined && !isPlainObject(desc.default)) {
    errors[k('default')] = 'default must be a plain object'
  }

  return errors
}

/**
 * Validate a normalized {@link KvSchema} (single or multi-driver).
 *
 * For multi-driver, errors are prefixed with the namespace name:
 * `{ 'local.base': 'base is required when driver is "http"' }`.
 */
export const validateKv = (schema: KvSchema): ValidateKvResult => {
  if (isSingleDriverSchema(schema)) {
    const errors = validateSingle(schema)
    return { ok: Object.keys(errors).length === 0, errors }
  }

  const entries = Object.entries(schema)
  if (entries.length === 0) {
    return { ok: false, errors: { kv: 'multi-driver map must not be empty' } }
  }

  const errors: Record<string, string> = {}
  for (const [ns, desc] of entries) {
    Object.assign(errors, validateSingle(desc, ns))
  }
  return { ok: Object.keys(errors).length === 0, errors }
}
