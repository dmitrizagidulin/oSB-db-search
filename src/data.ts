import MiniSearch from 'minisearch'
import type { Item, Recipe, Source } from './schema.ts'

// Everything the app needs in memory. Items and sources load up front, the
// recipe table loads the first time a detail page asks for it.
export interface Db {
  items: Item[]
  byName: Map<string, Item>
  sources: Source[]
  index: MiniSearch<Item>
}

const base = import.meta.env.BASE_URL

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(base + path)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} loading ${path}`)
  }
  return res.json() as Promise<T>
}

export function iconUrl(item: Item): string | undefined {
  return item.inventoryIcon ? `${base}assets/${item.inventoryIcon}` : undefined
}

export function displayName(item: Item): string {
  return item.shortdescription || item.itemName
}

export async function loadDb(): Promise<Db> {
  const [items, sources] = await Promise.all([
    fetchJson<Item[]>('data/items.json'),
    fetchJson<Source[]>('data/sources.json')
  ])
  const index = new MiniSearch<Item>({
    idField: 'itemName',
    fields: [
      'shortdescription',
      'itemName',
      'itemTags',
      'category',
      'description'
    ],
    extractField: (item, field) => {
      const value = (item as unknown as Record<string, unknown>)[field]
      return Array.isArray(value) ? value.join(' ') : String(value ?? '')
    },
    searchOptions: {
      boost: { shortdescription: 4, itemName: 3, itemTags: 2, category: 2 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND'
    }
  })
  index.addAll(items)
  return {
    items,
    byName: new Map(items.map(i => [i.itemName, i])),
    sources,
    index
  }
}

let recipesPromise: Promise<Recipe[]> | undefined

export function loadRecipes(): Promise<Recipe[]> {
  recipesPromise ??= fetchJson<Recipe[]>('data/recipes.json').catch(e => {
    // Drop the failed attempt so the next detail view retries.
    recipesPromise = undefined
    throw e
  })
  return recipesPromise
}
