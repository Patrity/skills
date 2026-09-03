import { parseTarGzip } from 'nanotar'
import type { RawBundle } from './types'
import { isExcludedPath } from './exclusions'

/**
 * GitHub tarballs prefix every entry with `<owner>-<repo>-<sha7>/`. Keep only file
 * entries under `<prefix>/skills/<slug>/…`, grouped by slug. Bytes are copied out of
 * the tar buffer so the (large) archive can be garbage-collected.
 */
export async function extractBundles(tgz: Uint8Array | ArrayBuffer): Promise<RawBundle[]> {
  const entries = await parseTarGzip(tgz, {
    filter: entry => /^[^/]+\/skills\/[^/]+\/.+/.test(entry.name)
  })
  const bySlug = new Map<string, Record<string, Uint8Array>>()
  for (const entry of entries) {
    if (entry.type !== 'file' || !entry.data) continue
    const [, , slug, ...rest] = entry.name.split('/')
    if (!slug || rest.length === 0 || slug.startsWith('.')) continue
    const rel = rest.join('/')
    if (isExcludedPath(rel)) continue
    if (!bySlug.has(slug)) bySlug.set(slug, {})
    bySlug.get(slug)![rel] = new Uint8Array(entry.data)
  }
  return [...bySlug.entries()].map(([slug, files]) => ({ slug, files }))
}
