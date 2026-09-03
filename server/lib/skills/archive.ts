import { unzipSync } from 'fflate'
import type { BundleFiles, RawBundle } from './types'
import { isExcludedPath } from './exclusions'

/** `<owner>-<repo>-<sha7>/skills/<slug>/<rest…>` — anything shallower is repo noise. */
const BUNDLE_ENTRY_RE = /^[^/]+\/skills\/[^/]+\/.+/

/**
 * GitHub zipballs prefix every entry with `<owner>-<repo>-<sha7>/` and include bare
 * directory entries (names ending in `/`). Keep only file entries under
 * `<prefix>/skills/<slug>/…`, grouped by slug, with the prefix stripped.
 *
 * Zip (unlike the ustar tarball) has no 100-character path limit, so deeply nested
 * reference files survive intact, and zero-byte files arrive as empty buffers rather
 * than disappearing.
 */
export function extractBundles(zip: Uint8Array | ArrayBuffer): RawBundle[] {
  const data = zip instanceof Uint8Array ? zip : new Uint8Array(zip)
  const entries = unzipSync(data, {
    filter: file => !file.name.endsWith('/') && BUNDLE_ENTRY_RE.test(file.name)
  })
  const bySlug = new Map<string, BundleFiles>()
  for (const [name, bytes] of Object.entries(entries)) {
    const [, , slug, ...rest] = name.split('/')
    if (!slug || rest.length === 0 || slug.startsWith('.')) continue
    const rel = rest.join('/')
    if (isExcludedPath(rel)) continue
    if (!bySlug.has(slug)) bySlug.set(slug, {})
    bySlug.get(slug)![rel] = bytes ?? new Uint8Array(0)
  }
  return [...bySlug.entries()].map(([slug, files]) => ({ slug, files }))
}
