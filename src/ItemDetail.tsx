import { useEffect, useState } from 'react'
import type { Db } from './data.ts'
import { displayName, loadRecipes } from './data.ts'
import { ItemIcon } from './ItemIcon.tsx'
import { rarityClass } from './rarity.ts'
import { emptyFilters, itemHash, searchHash, type FacetKey } from './route.ts'
import type { Item, Recipe } from './schema.ts'

function facetLink(facet: FacetKey, value: string) {
  return searchHash({
    q: '',
    filters: { ...emptyFilters(), [facet]: [value] },
    sort: 'relevance'
  })
}

function ItemRef({
  db,
  name,
  count
}: {
  db: Db
  name: string
  count?: number
}) {
  const item = db.byName.get(name)
  if (!item) {
    return (
      <span className="ref ref-missing">
        {count !== undefined && <b>{count}x</b>} <code>{name}</code>
      </span>
    )
  }
  return (
    <a className="ref" href={itemHash(name)} title={name}>
      <ItemIcon item={item} size={24} />
      {count !== undefined && <b>{count}x</b>}
      <span className={rarityClass(item.rarity)}>{displayName(item)}</span>
    </a>
  )
}

function RecipeRow({ db, recipe }: { db: Db; recipe: Recipe }) {
  const currency = Object.entries(recipe.currencyInputs)
  return (
    <li className="recipe">
      <span className="recipe-inputs">
        {recipe.input.map(i => (
          <ItemRef key={i.item} db={db} name={i.item} count={i.count} />
        ))}
        {currency.map(([name, amount]) => (
          <span key={name} className="ref">
            <b>{amount}</b> {name}
          </span>
        ))}
      </span>
      <span className="arrow">to</span>
      <ItemRef db={db} name={recipe.output.item} count={recipe.output.count} />
      <span className="recipe-groups">
        {recipe.groups
          .filter(g => g !== 'all')
          .map(g => (
            <span key={g} className="tag">
              {g}
            </span>
          ))}
      </span>
    </li>
  )
}

function Fact({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  if (
    children === undefined ||
    children === null ||
    children === false ||
    children === ''
  ) {
    return null
  }
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

function yesNo(v: boolean | undefined) {
  if (v === undefined) {
    return undefined
  }
  return v ? 'yes' : 'no'
}

type RecipesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recipes: Recipe[] }

function RecipeList({
  db,
  state,
  recipes,
  emptyText
}: {
  db: Db
  state: RecipesState
  recipes: Recipe[]
  emptyText: string
}) {
  if (state.status === 'loading') {
    return <p className="muted">Loading recipes...</p>
  }
  if (state.status === 'error') {
    return <p className="muted">Could not load recipes: {state.message}</p>
  }
  if (recipes.length === 0) {
    return <p className="muted">{emptyText}</p>
  }
  return (
    <ul className="recipes">
      {recipes.map(r => (
        <RecipeRow key={r.id} db={db} recipe={r} />
      ))}
    </ul>
  )
}

export function ItemDetail({ db, item }: { db: Db; item: Item }) {
  const [state, setState] = useState<RecipesState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    loadRecipes().then(
      recipes => live && setState({ status: 'ready', recipes }),
      e => live && setState({ status: 'error', message: String(e) })
    )
    return () => {
      live = false
    }
  }, [])

  const recipes = state.status === 'ready' ? state.recipes : []
  const craftedFrom = recipes.filter(r => r.output.item === item.itemName)
  const usedIn = recipes.filter(r =>
    r.input.some(i => i.item === item.itemName)
  )
  const collectables = Object.entries(item.collectablesOnPickup)

  return (
    <div className="page detail">
      <header className="top">
        <a className="brand" href="#/">
          oSB Item Search
        </a>
        <a className="back" href="#/">
          Search
        </a>
      </header>
      <main className="detail-main">
        <section className="detail-head">
          <ItemIcon item={item} size={96} />
          <div>
            <h1 className={rarityClass(item.rarity)}>{displayName(item)}</h1>
            <div className="detail-sub">
              <code>{item.itemName}</code>
              <a
                className={`badge ${rarityClass(item.rarity)}`}
                href={facetLink('rarity', item.rarity)}
              >
                {item.rarity}
              </a>
              <a href={facetLink('type', item.type)}>{item.type}</a>
              {item.category && (
                <a href={facetLink('category', item.category)}>
                  {item.category}
                </a>
              )}
              {item.wikiUrl && (
                <a href={item.wikiUrl} target="_blank" rel="noreferrer">
                  Starbounder wiki
                </a>
              )}
            </div>
            {item.description && (
              <p className="detail-desc">{item.description}</p>
            )}
          </div>
        </section>

        <section>
          <dl className="facts">
            <Fact label="Price">{item.price}</Fact>
            <Fact label="Level">{item.level}</Fact>
            <Fact label="Max stack">{item.maxStack}</Fact>
            <Fact label="Two-handed">{yesNo(item.twoHanded)}</Fact>
            <Fact label="Race">
              {item.race && (
                <a href={facetLink('race', item.race)}>{item.race}</a>
              )}
            </Fact>
            <Fact label="Object type">{item.objectType}</Fact>
            <Fact label="Tooltip">{item.tooltipKind}</Fact>
            <Fact label="Scannable">{yesNo(item.scannable)}</Fact>
            <Fact label="Printable">{yesNo(item.printable)}</Fact>
            <Fact label="Tags">
              {item.itemTags.length > 0 &&
                item.itemTags.map(t => (
                  <a
                    key={t}
                    className="tag"
                    href={searchHash({
                      q: t,
                      filters: emptyFilters(),
                      sort: 'relevance'
                    })}
                  >
                    {t}
                  </a>
                ))}
            </Fact>
            <Fact label="Colony tags">
              {item.colonyTags.length > 0 &&
                item.colonyTags.map(t => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
            </Fact>
            <Fact label="Teaches">
              {item.learnBlueprintsOnPickup.length > 0 &&
                item.learnBlueprintsOnPickup.map(n => (
                  <ItemRef key={n} db={db} name={n} />
                ))}
            </Fact>
            <Fact label="Collectable">
              {collectables.length > 0 &&
                collectables.map(([c, id]) => `${c}: ${id}`).join(', ')}
            </Fact>
          </dl>
        </section>

        <section>
          <h2>Crafted from</h2>
          <RecipeList
            db={db}
            state={state}
            recipes={craftedFrom}
            emptyText="Not craftable."
          />
        </section>

        <section>
          <h2>Used in</h2>
          <RecipeList
            db={db}
            state={state}
            recipes={usedIn}
            emptyText="Not an ingredient in any recipe."
          />
        </section>

        <footer className="foot">
          Source: <a href={facetLink('source', item.source)}>{item.source}</a>,{' '}
          <code>{item.sourceFile}</code>
        </footer>
      </main>
    </div>
  )
}
