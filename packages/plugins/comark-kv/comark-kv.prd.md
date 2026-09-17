# PRD: `comark-kv`

## Summary

A third-party Comark plugin that lets a document declare a `kv:` block in
frontmatter, backed by [unstorage](https://unstorage.unjs.io) (driver/adapter-
agnostic key-value storage), and exposes the result as a live, writable
`kv.` binding namespace usable directly with Comark core's two-way `::prop`
model binding (`comark/model`).

## Motivation

Comark's core `::prop`/`ComarkModel` two-way binding gives documents a
render-time contract for reading and writing state, but nothing persists
that state anywhere by default — it only lives in memory for the lifetime of
the render. Authors need a way to declare persisted, writable state directly
in frontmatter — form inputs that survive a reload, settings that sync
across tabs, or values shared with a backend store — without writing app
code. `comark-kv` provides that persistence layer behind the existing model
binding contract, using unstorage so the same document works unmodified
against localStorage, IndexedDB, Redis, S3, or any other unstorage driver.

## Design decisions

### Package name: `comark-kv`

Considered: `comark-unstorage`, `comark-storage`, `comark-kv`.

Named by capability rather than implementation: `comark-unstorage` ties the
name to a swappable implementation detail (unstorage's own selling point is
driver-agnosticism, so hard-coding it into the plugin name undercuts that);
`comark-storage` is too generic. `comark-kv` names what it gives document
authors — a `kv` namespace — while leaving unstorage as an implementation
detail that could in principle be swapped later without a rename.

### Frontmatter key: `default`, not `seed`

Initially drafted as `seed:`. Reconsidered: `seed` reads naturally as an
always-active input value, which is misleading here — `comark-kv`'s
fallback is used **only** on first hydration, when the storage key does not
yet exist; once a value is persisted, the fallback is never consulted again.
`default` (or `defaults` for multiple keys) is standard, unambiguous
terminology for "value used only if nothing's there yet" (env vars, config
files, etc. all use "default" this way), so it was chosen instead.

### Binding namespace: `kv.`, not `data.kv.`

Core's `::prop` binding examples use a `data.` root (e.g.
`::value="data.pass"`), but that root is not enforced by the framework —
it's simply whatever top-level key the document's `ComarkModel` was
initialized with (`createModelStore({ data: {...} })`). `comark-kv`
initializes its own top-level `kv` namespace in the shared model store, so
bindings read and write via `kv.*` directly (e.g. `::value="kv.name"`)
rather than `data.kv.*`.

**Dependency / risk:** this assumes the model store can be composed from
multiple plugin-owned namespaces (`kv`, and whatever other plugins add)
without requiring everything to funnel through a single `data` root. If a
future core change hard-requires `data.` as the sole namespace, this falls
back to `data.kv.*` paths with no other design changes needed — noted here
so the assumption is explicit and revisitable.

## Frontmatter schema

```yaml
kv:
  driver: browser        # unstorage driver name (browser, http, memory, ...)
  mount: prefs            # key prefix under the driver, e.g. "prefs:name"
  base: /api/kv             # only for proxied drivers (e.g. http -> server-side redis)
  default:                # optional; used only if a key doesn't already exist
    name: Ada
    subscribed: false
```

- `driver` — required. Any unstorage driver name. Browser-native drivers
  (`browser` → localStorage/sessionStorage/IndexedDB, `memory`) can be used
  directly client-side. Backend-only drivers (`redis`, `s3`, etc.) are not
  reachable from the browser and must be proxied through unstorage's `http`
  driver against a server endpoint running the real driver.
- `mount` — key prefix/namespace within the driver.
- `default` — optional per-key fallback values, applied only on first
  hydration (key absent in storage).

## Example usage

```yaml
---
title: Preferences
kv:
  driver: browser
  mount: prefs
  default:
    name: Ada
    subscribed: false
---
```

```md
# Hello, {{ kv.name }}

:input{::value="kv.name" placeholder="Your name"}

:input{::checked="kv.subscribed" type="checkbox"} Subscribe to updates
```

For a server-mediated store, only the driver config changes — the document
body is unaffected:

```yaml
kv:
  driver: http
  base: /api/kv
  mount: prefs
```

## Runtime behavior

1. **Hydration** — on model-store setup, `comark-kv` reads each declared key
   via `storage.getItem`. If absent, applies `default`. Because storage reads
   are async and core's model is synchronous, hydration needs a defined
   loading boundary for SSR/no-JS rendering — an initial value has to be
   resolvable before first paint, with the live storage-backed binding
   taking over once the client is running.
2. **Local write** — a `kv.*` write via `::prop` calls `model.set`, which
   `comark-kv` intercepts: apply the value optimistically in the model
   immediately, then fire `storage.setItem` asynchronously, with rollback on
   failure.
3. **External write** — `comark-kv` subscribes to `storage.watch()`. On a
   change event for a mounted key, it calls `model.set` internally, so other
   tabs/processes/remote writers cause re-renders and bound-input updates
   without a page reload.
4. **Conflict handling** — `storage.watch` reports whole-key changes, not
   diffs. For object-valued keys this is last-write-wins at the whole-value
   level, not field-level merge. This is a known v1 limitation, not a bug to
   fix — should be called out explicitly in docs rather than implied to be
   safer than it is.

## Relationship to core security guards

Core's model already includes write-path guards (safe/writable path
filtering, prototype-pollution protection on `set`). `comark-kv` should
route all writes through the same guarded `model.set` rather than bypassing
it, so a `kv.*` path is subject to the same filtering as any other
`::prop`-bound path.

## Out of scope (v1)

- Field-level / CRDT-style conflict resolution — last-write-wins only.
- Non-unstorage backends — driver support is exactly unstorage's driver set.
- A generic "remote signals" primitive as a public API — the underlying
  signal/persistence engine (potentially built on `alien-signals`) may be
  factored out as a standalone package later, but `comark-kv` v1 ships as a
  single integrated plugin, not split into a library + adapter from day one.

## Open questions

- Does core's `ComarkModel` support multiple independently-owned top-level
  namespaces cleanly, or does `kv.*` need to formally live under `data.kv.*`?
  (see Binding namespace decision above)
- Should `mount` be required, or default to the plugin name (`kv`) if
  omitted?
- What's the right SSR hydration boundary for a read/write value, given the
  render is synchronous but storage reads are not?
