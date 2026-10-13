// Record shapes for the generated tables. The README's Item Schema and
// Recipe Schema sections are the human-readable version of these.

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | 'Essential'

export interface Item {
  itemName: string
  type: string
  sourceFile: string
  shortdescription?: string
  description?: string
  category?: string
  rarity: Rarity
  inventoryIcon?: string
  price?: number
  maxStack?: number
  level?: number
  twoHanded?: boolean
  tooltipKind?: string
  itemTags: string[]
  learnBlueprintsOnPickup: string[]
  collectablesOnPickup: Record<string, string>
  objectType?: string
  race?: string
  colonyTags: string[]
  scannable?: boolean
  printable?: boolean
  craftedFrom: string[]
  usedIn: string[]
  wikiUrl?: string
}

export interface Recipe {
  id: string
  input: { item: string; count: number }[]
  output: { item: string; count: number }
  currencyInputs: Record<string, number>
  groups: string[]
  duration?: number
}
