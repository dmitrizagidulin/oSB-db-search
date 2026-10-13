# oSB-db-search

An [OpenStarbound](https://github.com/OpenStarbound/OpenStarbound) compatible
item and tag browser and search app. Inspired by the archived
[MarceloAlves/StarboundItems](https://github.com/MarceloAlves/StarboundItems)
project.

Built as a static site with Vite, React and TypeScript.

## Getting started

```shell
pnpm install
pnpm dev
```

`pnpm build` writes the production site to `dist/`.

`pnpm test` runs the autofix, format, lint and typecheck steps.

## Generating the data

The app reads static tables from `public/data/`, produced by
`scripts/generate.ts` from unpacked asset sources.

### Unpacking the game assets

The game ships its assets as paks: `assets/packed.pak` in the Starbound install
directory, `assets/opensb.pak` next to it in an OpenStarbound install, and one
pak per mod under `mods/`. Each pak is an asset source. The generator reads them
from `data/sources/` in this repo, one subdirectory per pak, which is
git-ignored.

Both the vanilla install and an OpenStarbound build include an `asset_unpacker`
tool next to the game binary. `pnpm unpack` runs it once per pak:

```shell
pnpm unpack <asset_unpacker> <pak-or-directory>...
```

A directory argument unpacks every pak directly inside it, which is the easy way
to pull in a whole `mods/` folder. Each pak lands in `data/sources/<pak name>/`,
replacing any earlier unpack of the same pak.

Where the tool and the paks live, by platform. Steam installs Starbound under
`steamapps/common/Starbound`:

- Linux: `~/.steam/steam/steamapps/common/Starbound` (or
  `~/.local/share/Steam/...`), tool at `linux/asset_unpacker`.
- macOS: `~/Library/Application Support/Steam/steamapps/common/Starbound`, tool
  at `osx/asset_unpacker`.
- Windows: `C:\Program Files (x86)\Steam\steamapps\common\Starbound`, tool at
  `win32\asset_unpacker.exe`.
- OpenStarbound build tree: tool at `dist/asset_unpacker`.

For example, on Linux:

```shell
SB=~/.steam/steam/steamapps/common/Starbound
pnpm unpack $SB/linux/asset_unpacker $SB/assets/packed.pak $SB/mods
```

Unpacking the vanilla pak takes a few seconds and produces about 1 GB of files.
It is the only required source. OpenStarbound's own `opensb.pak` adds no items,
objects or recipes. Never unpack into the game's own `assets` folder, since that
breaks the game.

### Running the generator

```shell
pnpm generate
```

The generator reads `data/sources/` by default. Pass a path to read another
directory of sources instead:

```shell
pnpm generate /path/to/sources
```

Sources are layered the way the engine layers them. Each pak's `_metadata` gives
it a name, a priority and optional `requires` and `includes` lists. The
generator orders sources by priority, breaks ties by name, moves every
dependency ahead of the source that lists it, and then lets the last source to
supply an asset path win. Asset paths are compared case-insensitively, as the
engine does. Items and recipes record the name of the source that supplied their
file, and `public/data/sources.json` lists the sources in load order.

Mods that change existing files through `.patch` files are not applied yet. Such
a mod shows up in `sources.json` but changes no item or recipe.

The script walks every item asset the engine recognizes (`.item`, `.consumable`,
`.object` and the rest), the `.codex` files the engine turns into items itself,
and `recipes/**/*.recipe`. It writes:

- `public/data/sources.json`, the loaded sources in load order, each with its
  `name`, `friendlyName`, `version` and `priority` from `_metadata`.
- `public/data/items.json` and `public/data/recipes.json`, the tables below.
- `public/data/raw/<itemName>.json`, the unmodified asset JSON per item, for the
  `/spawnitem` generator.
- `public/assets/<asset path>`, the icon PNGs, keeping their asset-relative
  paths.

Asset files are JSON with comments, trailing commas, and raw newlines inside
strings, so the script normalizes them before parsing with `comment-json`.
Duplicate item names, parse failures, missing `requires` sources and unresolved
icons or recipe references are reported as warnings. Sprite-sheet icons with a
frame suffix are copied whole; cropping to the named frame is not handled yet.

## Item Schema

Sketch of the core item record the app searches over. Field names follow the
game's own asset files where one exists. `itemName` is the unique key; the game
guarantees it is unique across an install.

```jsonc
{
  // Game identifier and primary key, e.g. "tomatojuice".
  "itemName": "string",
  // Source asset type, taken from the file extension: "consumable",
  // "object", "matitem", "sword", "head", and so on.
  "type": "string",
  // Name of the asset source (pak) that supplies the defining file, from its
  // _metadata: "base" for vanilla, "opensb_base" for OpenStarbound, or the
  // mod's own name. See public/data/sources.json.
  "source": "string",
  // Asset-relative path of the defining file,
  // e.g. "items/generic/food/tomatojuice.consumable".
  "sourceFile": "string",
  // Display name. Not unique, may be missing.
  "shortdescription": "string?",
  "description": "string?",
  // Category from the asset file, e.g. "food", "block", "furniture".
  "category": "string?",
  // Normalized to capitalized form. The game also uses "Essential"
  // for a few quest and tool items.
  "rarity": "Common | Uncommon | Rare | Legendary | Essential",
  // Asset-relative path to the icon PNG, e.g. "items/generic/food/tomatojuice.png".
  "inventoryIcon": "string?",
  "price": "integer?",
  "maxStack": "integer?",
  // Item level, present on armor and weapons.
  "level": "integer?",
  // Weapons and tools only.
  "twoHanded": "boolean?",
  // The engine's hint for which tooltip layout to use, e.g. "base",
  // "object", "container", "armor", "food".
  "tooltipKind": "string?",
  // Per-item tags from the asset file, e.g. ["weapon", "ranged"].
  "itemTags": "string[]",
  // Recipes taught by picking this item up, as item names.
  "learnBlueprintsOnPickup": "string[]",
  // Collection entries unlocked by picking this item up, as a map of
  // collection name to collectable id, e.g. { "fossils": "fossil_1" }.
  "collectablesOnPickup": "Record<string, string>",

  // Object-only fields (type is "object").
  // Finer-grained kind, e.g. "object", "container", "farmable",
  // "loungeable", "teleporter".
  "objectType": "string?",
  // Racial style, e.g. "apex", "floran". The engine defaults to "generic".
  "race": "string?",
  // Colony tags, e.g. ["crafting", "electronic"].
  "colonyTags": "string[]",
  // Whether the object can be scanned into the player's log.
  "scannable": "boolean?",
  // Whether the object appears in the Pixel Printer.
  "printable": "boolean?",

  // Derived at generation time.
  // Item names of the ingredients across every recipe that produces
  // this item. Empty when the item is not craftable.
  "craftedFrom": "string[]",
  // Item names of everything this item is an ingredient for.
  "usedIn": "string[]",
  // Derived from shortdescription.
  "wikiUrl": "string?",
  // The unmodified asset JSON. Used by the /spawnitem generator to
  // diff a user's edits into the command's parameters argument.
  // Loaded on demand, not part of the search index.
  "raw": "object"
}
```

## Recipe Schema

Recipes live in a separate table next to the item records. The item record's
`craftedFrom` and `usedIn` lists are derived from this table and serve search.
The table serves the detail view, where counts, stations and multiple recipes
per item matter. Field names follow the game's `.recipe` files.

```jsonc
{
  // Generator-assigned, e.g. the asset-relative path of the .recipe file.
  "id": "string",
  // Name of the asset source that supplies the .recipe file, as for items.
  "source": "string",
  "input": [{ "item": "string", "count": "integer" }],
  "output": { "item": "string", "count": "integer" },
  // Currency costs, as a map of currency name to amount,
  // e.g. { "money": 500 }.
  "currencyInputs": "Record<string, integer>",
  // Crafting station groups, e.g. ["craftingfurnace", "plain"].
  "groups": "string[]",
  // Crafting time in seconds. Falls back to the engine default when absent.
  "duration": "number?"
}
```

## Related Projects

- [OpenStarbound/OpenStarbound](https://github.com/OpenStarbound/OpenStarbound)
  -- the game engine source. Authoritative reference for how item, object and
  recipe asset files are parsed.
- [Amegatron/starbound-assets-schema](https://github.com/Amegatron/starbound-assets-schema)
  -- JSON Schema drafts describing Starbound asset files (items, recipes,
  projectiles).
- [njt1982/starbound-crafting-guide](https://github.com/njt1982/starbound-crafting-guide)
  -- Node script that walks unpacked assets and emits item and recipe JSON plus
  icons. Reference for the generator.
- [kielni/starbound-asset-doc](https://github.com/kielni/starbound-asset-doc) --
  Python tool that documents every property used across `.object` and
  `.statuseffect` files. Useful for discovering which fields exist.
- [MarceloAlves/StarboundItems](https://github.com/MarceloAlves/StarboundItems)
  -- the archived original. Feature list and the `/spawnitem` command generator
  idea come from here.

## License

[MIT](LICENSE.md)
