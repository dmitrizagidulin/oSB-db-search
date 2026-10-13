#!/usr/bin/env node
// Walks a directory of unpacked asset sources (one subdirectory per pak,
// see scripts/unpack.ts) and writes the item and recipe tables the app
// searches over, plus the icon PNGs they reference. Sources are layered the
// way the engine does it: ordered by _metadata priority and dependencies,
// with the last source to supply an asset path winning.
//
//   node scripts/generate.ts [sources-dir]   (default: data/sources)
//
// Outputs:
//   public/data/sources.json    Source[], in load order
//   public/data/items.json      Item[]
//   public/data/recipes.json    Recipe[]
//   public/data/raw/<itemName>.json   the unmodified asset JSON per item
//   public/assets/<asset path>  icon PNGs, keeping their asset-relative path

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join, posix, relative, sep } from 'node:path'
import { parse } from 'comment-json'
import type { Item, Rarity, Recipe, Source } from '../src/schema.ts'

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

const sourcesDir = process.argv[2] ?? 'data/sources'
if (!existsSync(sourcesDir)) {
  console.error(`sources directory not found: ${sourcesDir}`)
  console.error('usage: node scripts/generate.ts [sources-dir]')
  process.exit(1)
}
const outDir = 'public'
const warnings: string[] = []

function warn(file: string, message: string) {
  warnings.push(`${file}: ${message}`)
}

// Parses JSON text the way the engine's asset loader does; see
// escapeControlCharsInStrings below.
function parseAssetJson(text: string): any {
  return parse(escapeControlCharsInStrings(text), undefined, true)
}

// One unpacked pak. The engine identifies sources by the name in their
// _metadata file, so that is what items and recipes record as `source`;
// the directory name (the pak basename) only matters when a pak has no
// metadata.
interface LoadedSource {
  record: Source
  dir: string
  requires: string[]
  includes: string[]
}

function readSource(dir: string): LoadedSource {
  const metadataFile = ['_metadata', '.metadata']
    .map(name => join(dir, name))
    .find(existsSync)
  const metadata = metadataFile
    ? parseAssetJson(readFileSync(metadataFile, 'utf8'))
    : {}
  return {
    record: {
      name: metadata.name ?? basename(dir),
      friendlyName: optional<string>(metadata.friendlyName, 'string'),
      version: optional<string>(metadata.version, 'string'),
      priority: optional<number>(metadata.priority, 'number') ?? 0
    },
    dir,
    requires: stringList(metadata.requires),
    includes: stringList(metadata.includes)
  }
}

// Orders sources the way the engine's Root::scanForAssetSources does: by
// priority, ties broken by name, then with every source's requires and
// includes moved ahead of it. A missing requires is a warning here rather
// than the engine's fatal error.
function orderSources(sources: LoadedSource[]): LoadedSource[] {
  const byName = new Map(sources.map(s => [s.record.name, s]))
  const sorted = [...sources].sort(
    (a, b) =>
      a.record.priority - b.record.priority ||
      a.record.name.localeCompare(b.record.name)
  )
  const ordered: LoadedSource[] = []
  const visited = new Set<string>()
  const visit = (source: LoadedSource) => {
    if (visited.has(source.record.name)) {
      return
    }
    visited.add(source.record.name)
    for (const dep of source.requires) {
      const target = byName.get(dep)
      if (target) {
        visit(target)
      } else {
        warn(source.dir, `requires missing source ${dep}`)
      }
    }
    for (const dep of source.includes) {
      const target = byName.get(dep)
      if (target) {
        visit(target)
      }
    }
    ordered.push(source)
  }
  sorted.forEach(visit)
  return ordered
}

// One indexed file: its asset-relative path as the winning source spells
// it, the on-disk file, and the name of that source.
interface Asset {
  path: string
  file: string
  source: string
}

// Every asset path across all sources, keyed case-insensitively the way
// the engine's asset map is, with the last source to supply a path winning.
const assetIndex = new Map<string, Asset>()

function indexSource(source: LoadedSource) {
  const entries = readdirSync(source.dir, {
    recursive: true,
    withFileTypes: true
  })
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }
    const file = join(entry.parentPath, entry.name)
    const path = relative(source.dir, file).split(sep).join('/')
    assetIndex.set(path.toLowerCase(), {
      path,
      file,
      source: source.record.name
    })
  }
}

function findAsset(assetPath: string): Asset | undefined {
  return assetIndex.get(assetPath.toLowerCase())
}

function assetFile(file: string): string {
  const asset = findAsset(file)
  if (!asset) {
    throw new Error(`no such asset: ${file}`)
  }
  return asset.file
}

// Indexed assets whose lowercased path satisfies the predicate, sorted by
// path so output is deterministic regardless of directory walk order.
function assetsMatching(predicate: (lowerPath: string) => boolean): Asset[] {
  const matches: Asset[] = []
  for (const [key, asset] of assetIndex) {
    if (predicate(key)) {
      matches.push(asset)
    }
  }
  return matches.sort((a, b) => a.path.localeCompare(b.path))
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
  return parseAssetJson(readFileSync(assetFile(file), 'utf8'))
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

// inventoryIcon is a path string, possibly with a ":frame" suffix, or an
// array of drawables each with an "image" key. Frame suffixes are dropped;
// cropping sprite sheets to the named frame is not handled yet. Returns the
// icon's asset path as the winning source spells it (lookups are
// case-insensitive, e.g. "icons.png" in a config and "Icons.png" on disk),
// or undefined with a warning if no source has it.
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
  return found?.path
}

function copyIcon(iconPath: string) {
  const dest = join(outDir, 'assets', iconPath)
  if (existsSync(dest)) {
    return
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(assetFile(iconPath), dest)
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

function parseRecipe({ path: file, source }: Asset): Recipe | undefined {
  const config = readAssetJson(file)
  if (typeof config?.output?.item !== 'string') {
    warn(file, 'recipe has no output item')
    return undefined
  }
  return {
    id: file,
    source,
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
  { path: file, source }: Asset,
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
    source,
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
  const sourceDirs = readdirSync(sourcesDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => join(sourcesDir, e.name))
  const sources = orderSources(sourceDirs.map(readSource))
  for (const source of sources) {
    indexSource(source)
  }

  const recipes: Recipe[] = []
  const recipeAssets = assetsMatching(
    p => p.startsWith('recipes/') && p.endsWith('.recipe')
  )
  for (const asset of recipeAssets) {
    const recipe = tryParse(asset.path, () => parseRecipe(asset))
    if (recipe) {
      recipes.push(recipe)
    }
  }

  const items = new Map<string, Item>()
  const rawDir = join(outDir, 'data', 'raw')
  mkdirSync(rawDir, { recursive: true })
  const codexDefaults = readAssetJson('codex.config').defaultItemConfig ?? {}
  const itemAssets = assetsMatching(p =>
    ITEM_EXTENSIONS.includes(posix.extname(p).slice(1))
  )
  for (const asset of itemAssets) {
    const file = asset.path
    const type = posix.extname(file).slice(1)
    const parsed = tryParse(file, () =>
      buildItem(asset, type, loadItemConfig(file, type, codexDefaults))
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
  const sourceRecords = sources.map(s => s.record)
  const dataDir = join(outDir, 'data')
  writeFileSync(join(dataDir, 'sources.json'), JSON.stringify(sourceRecords))
  writeFileSync(join(dataDir, 'items.json'), JSON.stringify(sorted))
  writeFileSync(join(dataDir, 'recipes.json'), JSON.stringify(recipes))

  for (const line of warnings) {
    console.warn(line)
  }
  console.log(
    `${sources.length} sources (${sourceRecords.map(s => s.name).join(', ')}), ` +
      `${sorted.length} items, ${recipes.length} recipes, ${warnings.length} warnings`
  )
}

function pushUnique(list: string[], value: string) {
  if (!list.includes(value)) {
    list.push(value)
  }
}

main()
