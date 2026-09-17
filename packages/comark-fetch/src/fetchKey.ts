import type { FetchEntry, FetchKeyParts } from './types.ts'

export const buildFetchKeyParts = (entry: FetchEntry): FetchKeyParts => ({
  url: entry.url,
  method: (entry.method ?? 'GET').toUpperCase(),
  body: entry.body,
  headers: entry.headers,
})

/** Cache key: name stays the authoring key; parts prevent cache collisions. */
export const buildFetchKey = (name: string, entry: FetchEntry) =>
  ['comark-fetch', name, buildFetchKeyParts(entry)] as const
