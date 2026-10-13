import { useMemo, useSyncExternalStore } from 'react'

export const FACETS = ['type', 'category', 'rarity', 'race', 'source'] as const
export type FacetKey = (typeof FACETS)[number]
export type Filters = Record<FacetKey, string[]>

export const SORTS = ['relevance', 'name', 'rarity', 'price', 'level'] as const
export type SortKey = (typeof SORTS)[number]

export interface SearchQuery {
  q: string
  filters: Filters
  sort: SortKey
}

export type Route =
  { page: 'search'; query: SearchQuery } | { page: 'item'; name: string }

export function emptyFilters(): Filters {
  return { type: [], category: [], rarity: [], race: [], source: [] }
}

export function emptyQuery(): SearchQuery {
  return { q: '', filters: emptyFilters(), sort: 'relevance' }
}

// A non-default sort counts as a query, so the landing page never hides
// a sort control that is still in effect.
export function isBlank(query: SearchQuery): boolean {
  return (
    query.q === '' &&
    query.sort === 'relevance' &&
    FACETS.every(f => query.filters[f].length === 0)
  )
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  if (path.startsWith('item/')) {
    return {
      page: 'item',
      name: safeDecode(path.slice('item/'.length))
    }
  }
  const params = new URLSearchParams(path.replace(/^search\??/, ''))
  const filters = emptyFilters()
  for (const f of FACETS) {
    filters[f] = params.getAll(f)
  }
  const sort = params.get('sort') as SortKey | null
  return {
    page: 'search',
    query: {
      q: params.get('q') ?? '',
      filters,
      sort: sort && SORTS.includes(sort) ? sort : 'relevance'
    }
  }
}

function toHash(route: Route): string {
  if (route.page === 'item') {
    return `#/item/${encodeURIComponent(route.name)}`
  }
  const { q, filters, sort } = route.query
  const params = new URLSearchParams()
  if (q) {
    params.set('q', q)
  }
  for (const f of FACETS) {
    for (const v of filters[f]) {
      params.append(f, v)
    }
  }
  if (sort !== 'relevance') {
    params.set('sort', sort)
  }
  const s = params.toString()
  return s ? `#/search?${s}` : '#/'
}

export function searchHash(query: SearchQuery): string {
  return toHash({ page: 'search', query })
}

export function itemHash(name: string): string {
  return toHash({ page: 'item', name })
}

// location.hash is percent-decoded in Firefox, so read the raw form from
// the full URL to keep parsing consistent across browsers.
function currentHash(): string {
  const i = location.href.indexOf('#')
  return i === -1 ? '' : location.href.slice(i)
}

// Replaces the current history entry, for keystroke-driven changes.
export function replaceSearch(query: SearchQuery): void {
  const hash = searchHash(query)
  if (hash !== currentHash()) {
    location.replace(hash)
  }
}

function subscribe(cb: () => void): () => void {
  addEventListener('hashchange', cb)
  return () => removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash)
  return useMemo(() => parseHash(hash), [hash])
}

export function withFilter(
  query: SearchQuery,
  facet: FacetKey,
  value: string
): SearchQuery {
  const current = query.filters[facet]
  const next = current.includes(value)
    ? current.filter(v => v !== value)
    : [...current, value]
  return { ...query, filters: { ...query.filters, [facet]: next } }
}
