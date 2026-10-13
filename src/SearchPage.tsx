import { useEffect, useMemo, useRef, useState } from 'react'
import type { Db } from './data.ts'
import { displayName } from './data.ts'
import { ItemCard } from './ItemCard.tsx'
import { RARITY_ORDER } from './rarity.ts'
import {
  FACETS,
  SORTS,
  isBlank,
  replaceRoute,
  searchHash,
  withFilter,
  type FacetKey,
  type SearchQuery,
  type SortKey
} from './route.ts'
import type { Item } from './schema.ts'

const PAGE = 60

const FACET_LABELS: Record<FacetKey, string> = {
  type: 'Type',
  category: 'Category',
  rarity: 'Rarity',
  race: 'Race',
  source: 'Source'
}

function facetValue(item: Item, facet: FacetKey): string | undefined {
  return item[facet]
}

function matches(item: Item, query: SearchQuery, skip?: FacetKey): boolean {
  return FACETS.every(f => {
    if (f === skip || query.filters[f].length === 0) {
      return true
    }
    const v = facetValue(item, f)
    return v !== undefined && query.filters[f].includes(v)
  })
}

function countBy(items: Item[], facet: FacetKey): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const v = facetValue(item, facet)
    if (v !== undefined) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  const entries = [...counts]
  if (facet === 'rarity') {
    return entries.sort(
      (a, b) =>
        RARITY_ORDER.indexOf(a[0] as never) -
        RARITY_ORDER.indexOf(b[0] as never)
    )
  }
  return entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function sortItems(items: Item[], sort: SortKey): Item[] {
  const by = {
    relevance: () => 0,
    name: (a: Item, b: Item) => displayName(a).localeCompare(displayName(b)),
    rarity: (a: Item, b: Item) =>
      RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
    price: (a: Item, b: Item) => (b.price ?? -1) - (a.price ?? -1),
    level: (a: Item, b: Item) => (b.level ?? -1) - (a.level ?? -1)
  }[sort]
  return sort === 'relevance' ? items : [...items].sort(by)
}

export function SearchPage({ db, query }: { db: Db; query: SearchQuery }) {
  const blank = isBlank(query)
  const inputRef = useRef<HTMLInputElement>(null)
  // Page size resets whenever the query changes, without an effect.
  const queryKey = searchHash(query)
  const [paging, setPaging] = useState({ key: queryKey, shown: PAGE })
  const shown = paging.key === queryKey ? paging.shown : PAGE
  // The input owns its text so the controlled value updates synchronously;
  // the hash catches up on the next hashchange. Adopt the route's text when
  // it changes from outside (back button, pasted link, chip click).
  const [text, setText] = useState(query.q)
  const [routeQ, setRouteQ] = useState(query.q)
  if (query.q !== routeQ) {
    setRouteQ(query.q)
    setText(query.q)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  // Text hits, before facet filtering. Relevance order when there is a query.
  const hits = useMemo(() => {
    if (query.q.trim() === '') {
      return db.items
    }
    return db.index.search(query.q).map(r => db.byName.get(r.id)!)
  }, [db, query.q])

  const results = useMemo(
    () =>
      sortItems(
        hits.filter(i => matches(i, query)),
        query.sort
      ),
    [hits, query]
  )

  // Counts for a facet ignore that facet's own selection, so unselected
  // values still show how many items they would add.
  const facetCounts = useMemo(
    () =>
      Object.fromEntries(
        FACETS.map(f => [
          f,
          countBy(
            hits.filter(i => matches(i, query, f)),
            f
          )
        ])
      ) as Record<FacetKey, [string, number][]>,
    [hits, query]
  )

  const update = (next: SearchQuery) =>
    replaceRoute({ page: 'search', query: next })

  const chipCounts = useMemo(
    () => ({
      type: countBy(db.items, 'type').slice(0, 12),
      rarity: countBy(db.items, 'rarity').slice(0, 5),
      race: countBy(db.items, 'race').slice(0, 12)
    }),
    [db]
  )

  const chips = (facet: keyof typeof chipCounts) =>
    chipCounts[facet].map(([v, n]) => (
      <a
        key={v}
        className="chip"
        href={searchHash(withFilter(query, facet, v))}
      >
        {v} <span className="count">{n}</span>
      </a>
    ))

  return (
    <div className={blank ? 'page landing' : 'page'}>
      <header className="top">
        <a className="brand" href="#/">
          oSB Item Search
        </a>
        <input
          ref={inputRef}
          className="search"
          type="search"
          autoFocus
          placeholder="Search items, e.g. cool chair, ironbar, weapon"
          value={text}
          onChange={e => {
            setText(e.target.value)
            update({ ...query, q: e.target.value })
          }}
        />
        {!blank && (
          <span className="result-count">
            {results.length} {results.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </header>

      {blank ? (
        <section className="hero">
          <p className="hint">
            Type to search {db.items.length} items, or browse by type, rarity or
            race. Press <kbd>/</kbd> to focus the search box.
          </p>
          <h2>Type</h2>
          <div className="chips">{chips('type')}</div>
          <h2>Rarity</h2>
          <div className="chips">{chips('rarity')}</div>
          <h2>Race</h2>
          <div className="chips">{chips('race')}</div>
          <footer className="foot">
            Sources: {db.sources.map(s => s.friendlyName ?? s.name).join(', ')}.
          </footer>
        </section>
      ) : (
        <div className="results-layout">
          <aside className="facets">
            <label className="sort">
              Sort
              <select
                value={query.sort}
                onChange={e =>
                  update({ ...query, sort: e.target.value as SortKey })
                }
              >
                {SORTS.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {FACETS.map(f => {
              const entries = facetCounts[f]
              if (entries.length === 0) {
                return null
              }
              return (
                <details key={f} open className="facet">
                  <summary>{FACET_LABELS[f]}</summary>
                  <ul>
                    {entries.map(([v, n]) => (
                      <li key={v}>
                        <label>
                          <input
                            type="checkbox"
                            checked={query.filters[f].includes(v)}
                            onChange={() => update(withFilter(query, f, v))}
                          />
                          <span className="facet-value">{v}</span>
                          <span className="count">{n}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            })}
          </aside>
          <main className="grid">
            {results.length === 0 && <p className="empty">No items match.</p>}
            {results.slice(0, shown).map(item => (
              <ItemCard key={item.itemName} item={item} />
            ))}
            {shown < results.length && (
              <button
                className="more"
                onClick={() =>
                  setPaging({ key: queryKey, shown: shown + PAGE })
                }
              >
                Show {Math.min(PAGE, results.length - shown)} more of{' '}
                {results.length - shown}
              </button>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
