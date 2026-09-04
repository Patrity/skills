import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import type { CliManifest } from '../../../shared/types/setup'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE_DIR = join(HERE, '../fixtures/bundles/demo')
const MANIFEST_PATH = join(HERE, '../fixtures/manifest.json')

type BundleFiles = Record<string, Uint8Array>

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** Reads `cli/test/fixtures/bundles/demo/**` off disk, keyed by path relative to the bundle root. */
export function loadFixtureBundle(): BundleFiles {
  const files: BundleFiles = {}
  for (const full of walk(BUNDLE_DIR)) {
    const rel = relative(BUNDLE_DIR, full).split('\\').join('/')
    files[rel] = new Uint8Array(readFileSync(full))
  }
  return files
}

/** Zips the fixture bundle rooted at `<slug>/`, the shape `/api/skills/<slug>/download` serves. */
export function zipFixtureBundle(slug: string) {
  const files = loadFixtureBundle()
  const zippable: Record<string, Uint8Array> = {}
  for (const [path, bytes] of Object.entries(files)) zippable[`${slug}/${path}`] = bytes
  return zipSync(zippable)
}

/** Reads `cli/test/fixtures/manifest.json`, a fixture `CliManifest`. */
export function fixtureManifest(): CliManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as CliManifest
}
