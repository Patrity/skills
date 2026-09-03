import { zipSync, type Zippable } from 'fflate'
import type { BundleFiles } from './types'
import { MAX_FILE_BYTES } from './exclusions'

/** Zip a bundle rooted at `<slug>/` so it unpacks as one folder to merge into `.claude/`. */
export function buildZip(slug: string, files: BundleFiles, mtime: Date): Uint8Array {
  const entries: Zippable = {}
  for (const path of Object.keys(files).sort()) {
    const bytes = files[path]!
    if (bytes.byteLength > MAX_FILE_BYTES) continue
    entries[`${slug}/${path}`] = [bytes, { level: 6, mtime }]
  }
  return zipSync(entries)
}
