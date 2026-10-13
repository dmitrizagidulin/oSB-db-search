import type { Rarity } from './schema.ts'

export const RARITY_ORDER: Rarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Legendary',
  'Essential'
]

export function rarityClass(rarity: Rarity): string {
  return `rarity-${rarity.toLowerCase()}`
}
