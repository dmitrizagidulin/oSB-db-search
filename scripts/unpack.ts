#!/usr/bin/env node
// Unpacks one or more paks into data/sources/, one subdirectory per pak,
// which is the layout scripts/generate.ts reads.
//
//   node scripts/unpack.ts <asset_unpacker> <pak-or-directory>... [--out <dir>]
//
// A directory argument unpacks every *.pak directly inside it. Each pak goes
// to <out>/<pak basename>/, replacing whatever was there.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'

const {
  values: { out: outDir },
  positionals: [unpacker, ...inputs]
} = parseArgs({
  options: { out: { type: 'string', default: 'data/sources' } },
  allowPositionals: true
})
if (!unpacker || inputs.length === 0) {
  console.error(
    'usage: node scripts/unpack.ts <asset_unpacker> <pak-or-directory>... [--out <dir>]'
  )
  process.exit(1)
}

const paks = inputs.flatMap(input =>
  statSync(input).isDirectory()
    ? readdirSync(input)
        .filter(name => name.endsWith('.pak'))
        .sort()
        .map(name => join(input, name))
    : [input]
)

mkdirSync(outDir, { recursive: true })
for (const pak of paks) {
  const target = join(outDir, basename(pak, '.pak'))
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  execFileSync(unpacker, [pak, target], { stdio: 'inherit' })
}
console.log(`${paks.length} paks unpacked to ${outDir}`)
