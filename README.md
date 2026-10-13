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
`scripts/generate.ts` from an unpacked assets directory.

### Unpacking the game assets

The game ships its assets as a single `assets/packed.pak` inside the Starbound
install directory. Both the vanilla install and an OpenStarbound build include
an `asset_unpacker` tool next to the game binary. It takes the pak file and an
output directory. The examples below unpack into `data/unpacked/` in this repo,
which is git-ignored and is where the generator looks by default. Never unpack
into the game's own `assets` folder, since that breaks the game.

Linux (Steam installs to `~/.steam/steam/steamapps/common/Starbound`, or
`~/.local/share/Steam/steamapps/common/Starbound`):

```shell
cd ~/.steam/steam/steamapps/common/Starbound
./linux/asset_unpacker assets/packed.pak /path/to/oSB-db-search/data/unpacked
```

macOS:

```shell
cd ~/Library/Application\ Support/Steam/steamapps/common/Starbound
./osx/asset_unpacker assets/packed.pak /path/to/oSB-db-search/data/unpacked
```

Windows, from PowerShell or Command Prompt:

```powershell
cd "C:\Program Files (x86)\Steam\steamapps\common\Starbound"
.\win32\asset_unpacker.exe assets\packed.pak C:\path\to\oSB-db-search\data\unpacked
```

An OpenStarbound build tree has the tool at `dist/asset_unpacker` instead, and
it accepts the same arguments.

Unpacking the vanilla pak takes a few seconds and produces about 1 GB of files.
OpenStarbound's own `opensb.pak` adds no items, objects or recipes, so the
vanilla pak is enough. Mod paks can be unpacked into the same directory
afterwards to overlay their files, though `.patch` files are not applied.

### Running the generator

```shell
pnpm generate
```

The generator reads `data/unpacked/` by default. Pass a path to read another
directory instead:

```shell
pnpm generate /path/to/unpacked
```

The script walks every item asset the engine recognizes (`.item`, `.consumable`,
`.object` and the rest), the `.codex` files the engine turns into items itself,
and `recipes/**/*.recipe`. It writes:

- `public/data/items.json` and `public/data/recipes.json`, the tables below.
- `public/data/raw/<itemName>.json`, the unmodified asset JSON per item, for the
  `/spawnitem` generator.
- `public/assets/<asset path>`, the icon PNGs, keeping their asset-relative
  paths.

Asset files are JSON with comments, trailing commas, and raw newlines inside
strings, so the script normalizes them before parsing with `comment-json`. Asset
paths are resolved case-insensitively, as the engine does. Duplicate item names,
parse failures and unresolved icons or recipe references are reported as
warnings. Sprite-sheet icons with a frame suffix are copied whole; cropping to
the named frame is not handled yet.

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
