# Changelog

## 0.1.0 - TBD

- Initial Vite + React + TypeScript shell.
- Oxlint configured with the isomorphic-lib-template rule set, Prettier wired
  into the test script.
- Item schema sketch in the README, with fields drawn from the engine source and
  the related projects.
- Recipe table sketch in the README.
- `scripts/generate.ts` builds the item and recipe tables, raw item JSON and
  icons from an unpacked assets directory. Record types live in `src/schema.ts`.
- `scripts/unpack.ts` (`pnpm unpack`) unpacks paks into the git-ignored
  `data/sources/`, one directory per pak, which the generator reads by default.
  README instructions for finding `asset_unpacker` on each platform.
- Generator layers asset sources in engine order (priority, then `requires` and
  `includes`), last source wins per asset path. Items and recipes carry a
  `source` field naming the pak that supplied them, and `sources.json` lists the
  loaded sources in load order.
- Generator builds items from `.codex` files, the way the engine does.
- Generator resolves asset paths case-insensitively, matching the engine.
- Generator escapes raw newlines and tabs inside asset JSON strings before
  parsing, and reports parse failures as warnings instead of aborting.
- ROADMAP.md and archived-roadmap.md, following the isomorphic-lib-template item
  structure.
