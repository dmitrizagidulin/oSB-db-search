import { displayName, iconUrl } from './data.ts'
import type { Item } from './schema.ts'

export function ItemIcon({ item, size = 48 }: { item: Item; size?: number }) {
  const url = iconUrl(item)
  if (!url) {
    return (
      <span
        className="icon icon-missing"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <img
      className="icon"
      src={url}
      alt={displayName(item)}
      width={size}
      height={size}
      loading="lazy"
    />
  )
}
