# `comark-fetch` — Requirements Document

**Status:** Implemented — parse-time `fetch:` frontmatter resolves via HTTP into `tree.meta.fetch` with optional in-memory cache, retry, and SSRF allowlisting.

**Author:** Miguel (with design discussion assistance)

**Scope:** A Comark plugin that lets a Markdown document declare named HTTP sources in frontmatter and consume resolved payloads via `meta.fetch.*` bindings.

---

## 1. Background

[Comark](https://comark.dev) is a runtime Markdown parser/renderer with plugin `pre`/`post` hooks. The `binding` plugin interpolates `{{ path }}` against `frontmatter`, `meta`, `data`, and `props`.

`comark-fetch` runs outbound HTTP at parse time and writes JSON (or text) results to `tree.meta.fetch`.

---

## 2. Goals

1. Let a document declare named HTTP sources in `fetch:` frontmatter.
2. Resolve them at parse time into `meta.fetch.<name>`.
3. Record failures in `meta.fetchErrors.<name>`.
4. Work across every Comark renderer (no framework-specific code).
5. Fail closed on SSRF unless the host opts in via `allowOrigins` or a custom `fetch`.

## 3. Non-goals

- Live streaming (SSE, WebSocket).
- Mutations / write operations.
- Executable code in documents.

---

## 4. Frontmatter schema

```yaml
---
fetch:
  posts: https://jsonplaceholder.typicode.com/posts   # shorthand → GET

  search:
    url: https://api.example.com/search
    method: POST
    headers:
      content-type: application/json
    body: '{"q":1}'
    staleTime: 60_000
    retry: 2
    enabled: true
---
```

| Field | Notes |
| --- | --- |
| `url` | Required absolute `http(s)` URL |
| `method` | Default `GET` |
| `headers`, `body`, `credentials` | Subset of `RequestInit` |
| `staleTime`, `gcTime`, `retry`, `enabled` | Parse-time cache / retry semantics |

---

## 5. Meta output

| Key | Content |
| --- | --- |
| `meta.fetch.<name>` | Parsed response (JSON object/array or text) |
| `meta.fetchErrors.<name>` | `{ message, url? }` on failure |

---

## 6. Authoring

```mdc
Loaded **{{ meta.fetch.posts.length }}** posts.

::table{:rows="meta.fetch.posts"}
::
```

---

## 7. Plugin options

| Option | Default | Notes |
| --- | --- | --- |
| `enabled` | `true` | Disable plugin |
| `allowOrigins` | `[]` | SSRF allowlist; `['*']` for trusted authors |
| `fetch` | `globalThis.fetch` | Custom fetch bypasses empty allowlist |
| `cache` | process singleton | Optional `FetchCache` |
| `throwOnError` | `false` | Reject parse on fetch failure |

---

## 8. References

- [Comark Plugin API](https://comark.dev/plugins/custom/plugin-api)
- [Binding plugin](https://comark.dev/plugins/built-in/binding)
- [Frontmatter](https://comark.dev/syntax/frontmatter)
