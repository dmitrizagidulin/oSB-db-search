// Record shapes for the generated tables. The README's Item Schema and
// Recipe Schema sections are the human-readable version of these.

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | 'Essential'

// One asset source (an unpacked pak), identified by its _metadata name.
// sources.json lists them in engine load order.
export interface Source {
  name: string
  friendlyName?: string
  version?: string
  priority: number
}

export interface Item {
  itemName: string
  type: string
  // Name of the source that supplies the defining file.
  source: string
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
  source: string
  input: { item: string; count: number }[]
  output: { item: string; count: number }
  currencyInputs: Record<string, number>
  groups: string[]
  duration?: number
}
