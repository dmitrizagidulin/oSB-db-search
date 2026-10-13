# oSB Item Search Roadmap (open items)

nextAvailableId: 3

Status as of 2026-10-13. Uses the formalized item structure shared with the
isomorphic-lib-template and freewallet roadmaps.

Scope: open work items only. This document tracks the remaining items; completed
items move verbatim to [archived-roadmap.md](archived-roadmap.md) as they land,
so OSB-N references keep resolving (CHANGELOG.md remains the record of what
landed).

## Item format

Each work item is a `### OSB-N: Title` heading followed by a field block and
free prose context. Ids are permanent and never reused. The `nextAvailableId`
line at the top of this file is the next id to take: filing an item takes that
number and rewrites the line to one higher, in the same edit. Never derive the
next id by scanning, since the highest id usually sits in `archived-roadmap.md`
rather than here.

- Fields: `status` (`todo` / `in-progress` / `draft` / `done`), `priority`
  (`high` / `medium` / `low`), `labels` (comma-separated), optional `blocked-by`
  (other `OSB-N` ids), and an `acceptance:` checklist.
- The prose opens with a `Context:` paragraph that states what is wrong today,
  how it came about, and why it matters, readable on its own. Mechanics
  (file:line cites, edge cases) follow in ordinary prose after it.
- `draft` marks items with no actionable done-state yet; a draft states why
  instead of acceptance criteria and gains them when promoted to `todo`.
- Every non-draft item needs acceptance criteria before it moves to
  `in-progress`. Statuses are edited in place and checkboxes ticked as met.
- Work discovered mid-implementation gets its own item immediately, noting
  `discovered-from: OSB-N` in its prose.
- Never create a parallel task list elsewhere (no `TODO.md`, no task lists in
  other docs).

---

### OSB-1: Apply `.patch` files when layering asset sources

- status: todo
- priority: high
- labels: generator, mods
- acceptance:
  - [ ] `foo.ext.patch` (and `.patch0` to `.patch9`) in any source is applied to
        `foo.ext` when that file is already supplied by an earlier source in
        load order; a patch whose target no source has yet is ignored, as in the
        engine.
  - [ ] Patches from every source apply in load order, then in path order within
        a source, over the content of whichever source won the file.
  - [ ] Accepted patch shapes: a top-level array of RFC 6902 operations (`add`,
        `remove`, `replace`, `move`, `copy`, `test`), nested arrays applied
        recursively, and a top-level object deep-merged with `null` deleting the
        key. Engine extensions `test` with `inverse` and `merge` are supported.
  - [ ] A failed `test` in a nested array skips that array silently; any other
        failed operation is reported as a warning naming the patch file and the
        target, and the remaining operations still apply.
  - [ ] Items and recipes whose file was patched record the names of the
        patching sources in a `patchedBy: string[]` field, documented in the
        README schema sections and in `src/schema.ts`. The field name and shape
        need the user's sign-off before coding.
  - [ ] `.patch.lua`, `.patchlist` and `_metadata` `scripts` are not applied;
        each occurrence is reported once as a warning so the user knows the
        modded view is incomplete.
  - [ ] Running the generator against vanilla plus a known patch-only mod (for
        example a price adjustment mod) changes the patched items' fields and
        leaves the vanilla-only output byte-identical to before.
  - [ ] README "Running the generator" drops the "not applied yet" caveat and
        describes what is and is not applied; CHANGELOG entry.

Context: The generator layers unpacked paks the way the engine orders them, but
it only reproduces whole-file replacement. Most workshop mods change vanilla
content through `.patch` files rather than replacing files, so with patches
ignored a modded `data/sources/` produces a database that lists the mod in
`sources.json` but shows vanilla prices, recipes and descriptions. The modded
view is the main reason to load mods at all, so the generator is not useful for
them until patches apply.

The engine's behavior to match lives in the OpenStarbound source. Patch
discovery and attachment are in `source/base/StarAssets.cpp` around lines
326-361: a patch attaches only if its target is already in the asset map when
the patch's source is processed, and the target descriptor keeps its patch list
when a later source replaces the file. Application order and the accepted shapes
are in `applyJsonPatches` and `checkPatchArray` (same file, around lines
1098-1180); a string element in a patch array loads that asset as the external
reference for later operations, and a top-level object merges via
`jsonMergeNulling`. The operation set, including `test` with `inverse` and
`merge`, is in `source/core/StarJsonPatch.cpp` around lines 38-44. Lua patches
and the `onLoad` / `postLoad` scripts (same file, lines 169-316 and 373-420) can
rewrite or add arbitrary assets and are out of scope here; a later item can
decide whether to embed a Lua runtime or read merged assets from a running
engine instead.

Implementation sketch: the asset index already maps every path to its winning
source. Add a parallel map from target path to the ordered list of patch entries
found while indexing. `readAssetJson` then parses the base file and folds the
patches over it before returning, so item and recipe parsing need no changes
beyond the provenance field. Raw item JSON in `public/data/raw/` should be the
patched result, since that is what the engine sees.

### OSB-2: Crop sprite sheet icons to the named frame

- status: todo
- priority: high
- labels: generator, icons
- acceptance:
  - [ ] An `inventoryIcon` with a `:frame` suffix (as a plain string or as the
        last drawable's `image` in an array) is cropped to that frame's rect and
        the cropped PNG is what `public/assets/` holds and the item record
        points at. Icons without a suffix are copied whole, as today.
  - [ ] The `.frames` file is found the way the engine finds it: in the image's
        directory, `<image basename>.frames` first, then `default.frames`, then
        the same two names in each parent directory up to the asset root.
        Lookups go through the layered source index, so a mod can supply or
        replace a frames file.
  - [ ] Both frames shapes parse: `frameList` (name to `[x1, y1, x2, y2]`) and
        `frameGrid` (`size`, `dimensions`, optional `begin`, optional `names`
        rows; unnamed cells are numbered row-major from 0). `aliases` resolve to
        a frame name, following alias chains.
  - [ ] A missing frames file, unknown frame name, or rect outside the image is
        reported as a warning naming the item file and the icon reference, and
        the item keeps the whole sheet so it still has an icon.
  - [ ] Running the generator leaves every item that had a whole-sheet icon
        before with a square icon of the frame's size; armor, codex, and
        container icons in the search grid render at full card size.
  - [ ] README "Running the generator" drops the "copied whole" caveat and
        describes the cropping; CHANGELOG entry.

Context: Armor and many object icons point at a sprite sheet with a frame
suffix, for example `icons.png:chest` in `apextier1.chest`, where
`items/armors/icons.frames` maps `chest` to the second 16x16 cell. The generator
drops the suffix and copies the whole sheet, so about 770 items show a four-cell
strip scaled down to the card icon size, and the search grid reads as rows of
unreadable smudges for every armor set. The README already notes the gap; with
the UI in place it is the most visible data defect.

The engine's behavior to match is in the OpenStarbound source. Frames file
discovery is in `source/base/StarAssets.cpp` around lines 1000-1015 (walk up
from the image's directory, `<basename>.frames` before `default.frames` at each
level). Parsing of `frameList`, `frameGrid` and `aliases` is in
`parseFramesSpecification` in the same file, around lines 755-845. The crop
itself is a plain rect copy, see `imageFrames` and `getRect` used from
`source/game/StarImageMetadataDatabase.cpp` around line 175. Image directives
that can follow the frame name (`?hueshift=...` and the like) are out of scope
here; the generator keeps dropping them, and a later item can decide whether to
apply them.

Implementation sketch: `resolveIcon` in `scripts/generate.ts` already splits the
reference on `:`; keep the frame name, look up the frames file through the
existing asset index, compute the rect, and have `copyIcon` write a cropped PNG
instead of copying. A small pure-JS PNG codec (for example `pngjs`) is enough,
since icons are tiny and the generator runs offline. The cropped file needs a
path that differs from the sheet's, so the sheet and several frames of it can
coexist under `public/assets/`; that output path convention, and whether
`inventoryIcon` in `items.json` keeps the engine's `path:frame` form or points
at the cropped file, are wire-level choices that need the user's sign-off before
coding.
