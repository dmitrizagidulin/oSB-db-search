#!/usr/bin/env node
// Walks an unpacked OpenStarbound assets directory and writes the item and
// recipe tables the app searches over, plus the icon PNGs they reference.
//
//   node scripts/generate.ts [unpacked-assets-dir]   (default: data/unpacked)
//
// Outputs:
//   public/data/items.json      Item[]
//   public/data/recipes.json    Recipe[]
//   public/data/raw/<itemName>.json   the unmodified asset JSON per item
//   public/assets/<asset path>  icon PNGs, keeping their asset-relative path

import {
  copyFileSync,
  existsSync,
  globSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { parse } from 'comment-json'
import type { Item, Rarity, Recipe } from '../src/schema.ts'

// Item asset extensions the engine's ItemDatabase recognizes, plus .object
// and .codex, which the engine turns into items itself.
const ITEM_EXTENSIONS = [
  'item',
  'liqitem',
  'matitem',
  'miningtool',
  'flashlight',
  'wiretool',
  'beamaxe',
  'tillingtool',
  'painttool',
  'harvestingtool',
  'head',
  'chest',
  'legs',
  'back',
  'currency',
  'consumable',
  'blueprint',
  'inspectiontool',
  'instrument',
  'thrownitem',
  'unlock',
  'activeitem',
  'augment',
  'object',
  'codex'
]

const WIKI_BASE = 'https://starbounder.org/'

const assetsDir = process.argv[2] ?? 'data/unpacked'
if (!existsSync(assetsDir)) {
  console.error(`assets directory not found: ${assetsDir}`)
  console.error('usage: node scripts/generate.ts [unpacked-assets-dir]')
  process.exit(1)
}
const outDir = 'public'
const warnings: string[] = []

function warn(file: string, message: string) {
  warnings.push(`${file}: ${message}`)
}

// Starbound asset files are JSON with C-style comments, the occasional
// trailing comma, and (in codex files) raw newlines and tabs inside string
// literals. comment-json handles the first two; this escapes the control
// characters inside strings so it can handle the third.
const CONTROL_ESCAPES: Record<string, string> = {
  '\n': '\\n',
  '\t': '\\t',
  '\r': ''
}

function escapeControlCharsInStrings(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString && ch === '\\') {
      out += ch + (text[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '"') {
      inString = !inString
    }
    out += inString ? (CONTROL_ESCAPES[ch] ?? ch) : ch
  }
  return out
}

// Throws on malformed JSON; per-file callers go through tryParse.
function readAssetJson(file: string): any {
  const text = readFileSync(join(assetsDir, file), 'utf8')
  return parse(escapeControlCharsInStrings(text), undefined, true)
}

// Runs one per-file step, turning a parse failure into a warning.
function tryParse<T>(file: string, step: () => T): T | undefined {
  try {
    return step()
  } catch (err) {
    warn(file, `parse error: ${(err as Error).message}`)
    return undefined
  }
}

// Strips the game's inline color codes, e.g. "^orange;Legendary^reset;".
function stripColorCodes(text: string): string {
  return text.replace(/\^[^;^]*;/g, '')
}

function normalizeRarity(value: unknown, file: string): Rarity {
  const text = typeof value === 'string' ? value.toLowerCase() : 'common'
  const known: Record<string, Rarity> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    legendary: 'Legendary',
    essential: 'Essential'
  }
  const rarity = known[text]
  if (!rarity) {
    warn(file, `unknown rarity ${JSON.stringify(value)}, using Common`)
    return 'Common'
  }
  return rarity
}

// Resolves an asset path the way the engine does: absolute paths are
// relative to the assets root, anything else is relative to the file's
// directory. Returns the asset-relative path without a leading slash.
function resolveAssetPath(ref: string, file: string): string {
  if (ref.startsWith('/')) {
    return ref.slice(1)
  }
  return posix.join(posix.dirname(file), ref)
}

// The engine looks assets up case-insensitively, and the vanilla files rely
// on that (e.g. "icons.png" in the config, "Icons.png" on disk). Resolves an
// asset-relative path to the name actually on disk, one segment at a time.
const dirCache = new Map<string, Map<string, string>>()

function listDir(relative: string): Map<string, string> {
  let entries = dirCache.get(relative)
  if (!entries) {
    let names: string[] = []
    try {
      names = readdirSync(join(assetsDir, relative))
    } catch {
      // Not a directory: every lookup under it misses.
    }
    entries = new Map(names.map(e => [e.toLowerCase(), e]))
    dirCache.set(relative, entries)
  }
  return entries
}

function findAsset(assetPath: string): string | undefined {
  let resolved = ''
  for (const segment of assetPath.split('/')) {
    const entries = listDir(resolved)
    const actual = entries.get(segment.toLowerCase())
    if (!actual) {
      return undefined
    }
    resolved = resolved ? `${resolved}/${actual}` : actual
  }
  return resolved
}

// inventoryIcon is a path string, possibly with a ":frame" suffix, or an
// array of drawables each with an "image" key. Frame suffixes are dropped;
// cropping sprite sheets to the named frame is not handled yet. Returns the
// icon's on-disk asset path, or undefined (with a warning) if unresolvable.
function resolveIcon(value: unknown, file: string): string | undefined {
  let ref: unknown = value
  if (Array.isArray(value)) {
    ref = value.at(-1)?.image
  }
  if (typeof ref !== 'string') {
    if (value !== undefined) {
      warn(file, 'unrecognized inventoryIcon shape')
    }
    return undefined
  }
  const [path] = ref.split(':')
  const assetPath = resolveAssetPath(path, file)
  const found = findAsset(assetPath)
  if (!found) {
    warn(file, `icon not found: ${assetPath}`)
  }
  return found
}

function copyIcon(iconPath: string) {
  const dest = join(outDir, 'assets', iconPath)
  if (existsSync(dest)) {
    return
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(join(assetsDir, iconPath), dest)
}

// learnBlueprintsOnPickup entries are item descriptors: either a bare item
// name or an object with a "name" key.
function descriptorNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(entry => (typeof entry === 'string' ? entry : entry?.name))
    .filter((name): name is string => typeof name === 'string')
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(v => typeof v === 'string') : []
}

function optional<T>(value: unknown, type: 'string' | 'number' | 'boolean') {
  return typeof value === type ? (value as T) : undefined
}

function wikiUrl(shortdescription: string | undefined): string | undefined {
  if (!shortdescription) {
    return undefined
  }
  return WIKI_BASE + encodeURIComponent(shortdescription.replace(/ /g, '_'))
}

function parseRecipe(file: string): Recipe | undefined {
  const config = readAssetJson(file)
  if (typeof config?.output?.item !== 'string') {
    warn(file, 'recipe has no output item')
    return undefined
  }
  return {
    id: file,
    input: (config.input ?? []).map((d: any) => ({
      item: d.item,
      count: d.count ?? 1
    })),
    output: { item: config.output.item, count: config.output.count ?? 1 },
    currencyInputs: config.currencyInputs ?? {},
    groups: stringList(config.groups),
    duration: optional<number>(config.duration, 'number')
  }
}

// Reads an item asset into the common item config shape. Objects name
// themselves with objectName. Codex items are not asset files of their own:
// the engine builds one item per .codex file, named "<id>-codex", from
// codex.config's defaultItemConfig merged with the codex's own itemConfig.
function loadItemConfig(file: string, type: string, codexDefaults: any): any {
  const config = readAssetJson(file)
  if (type === 'codex') {
    return {
      ...codexDefaults,
      ...config.itemConfig,
      itemName: `${config.id}-codex`,
      shortdescription: config.title,
      description: config.description,
      inventoryIcon: config.icon
    }
  }
  if (type === 'object') {
    return { ...config, itemName: config.objectName }
  }
  return config
}

function buildItem(
  file: string,
  type: string,
  config: any
): { item: Item; raw: any } | undefined {
  const itemName = config?.itemName
  if (typeof itemName !== 'string') {
    warn(file, 'missing itemName')
    return undefined
  }

  const shortdescription = optional<string>(config.shortdescription, 'string')
  const cleanName = shortdescription && stripColorCodes(shortdescription)
  const inventoryIcon = resolveIcon(config.inventoryIcon, file)
  if (inventoryIcon) {
    copyIcon(inventoryIcon)
  }

  const item: Item = {
    itemName,
    type,
    sourceFile: file,
    shortdescription: cleanName,
    description: optional<string>(config.description, 'string'),
    category: optional<string>(config.category, 'string'),
    rarity: normalizeRarity(config.rarity, file),
    inventoryIcon,
    price: optional<number>(config.price, 'number'),
    maxStack: optional<number>(config.maxStack, 'number'),
    level: optional<number>(config.level, 'number'),
    twoHanded: optional<boolean>(config.twoHanded, 'boolean'),
    tooltipKind: optional<string>(config.tooltipKind, 'string'),
    itemTags: stringList(config.itemTags),
    learnBlueprintsOnPickup: descriptorNames(config.learnBlueprintsOnPickup),
    collectablesOnPickup: config.collectablesOnPickup ?? {},
    colonyTags: stringList(config.colonyTags),
    craftedFrom: [],
    usedIn: [],
    wikiUrl: wikiUrl(cleanName)
  }

  if (type === 'object') {
    // Defaults follow the engine's ObjectDatabase: objects are scannable
    // unless they say otherwise, and printable defaults to scannable.
    const scannable = config.scannable ?? true
    item.objectType = config.objectType ?? 'object'
    item.race = config.race ?? 'generic'
    item.scannable = scannable
    item.printable = config.printable ?? scannable
    item.tooltipKind ??= 'object'
  }

  return { item, raw: config }
}

function main() {
  const recipes: Recipe[] = []
  for (const file of globSync('recipes/**/*.recipe', { cwd: assetsDir })) {
    const recipe = tryParse(file, () => parseRecipe(file))
    if (recipe) {
      recipes.push(recipe)
    }
  }

  const items = new Map<string, Item>()
  const rawDir = join(outDir, 'data', 'raw')
  mkdirSync(rawDir, { recursive: true })
  const codexDefaults = readAssetJson('codex.config').defaultItemConfig ?? {}
  const pattern = `**/*.{${ITEM_EXTENSIONS.join(',')}}`
  for (const file of globSync(pattern, { cwd: assetsDir })) {
    const type = posix.extname(file).slice(1)
    const parsed = tryParse(file, () =>
      buildItem(file, type, loadItemConfig(file, type, codexDefaults))
    )
    if (!parsed) {
      continue
    }
    const { item, raw } = parsed
    if (items.has(item.itemName)) {
      warn(file, `duplicate itemName ${item.itemName}, keeping the first`)
      continue
    }
    items.set(item.itemName, item)
    writeFileSync(join(rawDir, `${item.itemName}.json`), JSON.stringify(raw))
  }

  // Derive the per-item recipe links.
  for (const recipe of recipes) {
    const output = items.get(recipe.output.item)
    if (!output) {
      warn(recipe.id, `output ${recipe.output.item} is not a known item`)
      continue
    }
    for (const { item: inputName } of recipe.input) {
      const input = items.get(inputName)
      if (!input) {
        warn(recipe.id, `input ${inputName} is not a known item`)
        continue
      }
      pushUnique(output.craftedFrom, inputName)
      pushUnique(input.usedIn, output.itemName)
    }
  }

  const sorted = [...items.values()].sort((a, b) =>
    a.itemName.localeCompare(b.itemName)
  )
  writeFileSync(join(outDir, 'data', 'items.json'), JSON.stringify(sorted))
  writeFileSync(join(outDir, 'data', 'recipes.json'), JSON.stringify(recipes))

  for (const line of warnings) {
    console.warn(line)
  }
  console.log(
    `${sorted.length} items, ${recipes.length} recipes, ${warnings.length} warnings`
  )
}

function pushUnique(list: string[], value: string) {
  if (!list.includes(value)) {
    list.push(value)
  }
}

main()
