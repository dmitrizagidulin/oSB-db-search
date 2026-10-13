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
- README instructions for unpacking the game assets into the git-ignored
  `data/unpacked/`, which the generator reads by default.
- Generator builds items from `.codex` files, the way the engine does.
- Generator resolves asset paths case-insensitively, matching the engine.
- Generator escapes raw newlines and tabs inside asset JSON strings before
  parsing, and reports parse failures as warnings instead of aborting.
