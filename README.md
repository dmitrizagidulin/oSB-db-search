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
  // Per-item tags from the asset file, e.g. ["weapon", "ranged"].
  "itemTags": "string[]",
  // Colony tags, present on objects only, e.g. ["crafting", "electronic"].
  "colonyTags": "string[]",
  // Recipes taught by picking this item up, as item names.
  "learnBlueprintsOnPickup": "string[]",
  // Derived at generation time from shortdescription.
  "wikiUrl": "string?"
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
