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
