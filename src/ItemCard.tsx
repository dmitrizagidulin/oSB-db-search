import { displayName } from './data.ts'
import { ItemIcon } from './ItemIcon.tsx'
import { rarityClass } from './rarity.ts'
import { itemHash } from './route.ts'
import type { Item } from './schema.ts'

export function ItemCard({ item }: { item: Item }) {
  return (
    <a className="card" href={itemHash(item.itemName)}>
      <ItemIcon item={item} />
      <div className="card-body">
        <div className={`card-title ${rarityClass(item.rarity)}`}>
          {displayName(item)}
        </div>
        <div className="card-meta">
          <code>{item.itemName}</code>
          <span>
            {item.type}
            {item.category ? ` / ${item.category}` : ''}
          </span>
        </div>
        {item.description && (
          <div className="card-desc">{item.description}</div>
        )}
      </div>
    </a>
  )
}
