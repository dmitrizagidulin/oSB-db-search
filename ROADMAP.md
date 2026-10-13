# oSB Item Search Roadmap (open items)

nextAvailableId: 2

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
