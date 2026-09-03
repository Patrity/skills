import type { SkillManifest, SnapshotMeta } from '../../../shared/types/skills'
import type { BundleFiles, SkillsSource, Snapshot } from './types'

/** Structurally matches `RuntimeCache` from @vercel/functions. */
export interface StoreCache {
  get(key: string): Promise<unknown | null>
  set(key: string, value: unknown, options?: { ttl?: number, tags?: string[] }): Promise<void>
}

export interface ManifestRecord {
  meta: SnapshotMeta
  skills: SkillManifest[]
}

export interface SnapshotStore {
  getManifests(): Promise<ManifestRecord>
  getBundleFiles(slug: string): Promise<BundleFiles | null>
  refresh(): Promise<SnapshotMeta>
}

export interface StoreOptions {
  source: SkillsSource
  cache?: StoreCache | null
  /** Runtime Cache TTL (seconds). A safety net only; freshness comes from purges. */
  cacheTtl?: number
  /** How long (ms) the in-process memo is trusted before re-checking the cache. */
  memoTtl?: number
  now?: () => number
}

export const CACHE_TAG = 'skills'
export const MANIFEST_KEY = 'manifest'
export const bundleKey = (slug: string) => `bundle:${slug}`

/** Keeps each cached bundle comfortably under Vercel's 2 MB Runtime Cache item limit. */
const MAX_CACHED_BUNDLE_CHARS = 1_500_000

interface BundleRecord {
  files: Record<string, string>
}

function pickMeta(snap: Snapshot): SnapshotMeta {
  return { sha: snap.sha, committedAt: snap.committedAt, fetchedAt: snap.fetchedAt, source: snap.source }
}

function encodeBundle(files: BundleFiles): BundleRecord | null {
  const out: Record<string, string> = {}
  let chars = 0
  for (const [path, bytes] of Object.entries(files)) {
    const b64 = Buffer.from(bytes).toString('base64')
    chars += b64.length + path.length
    if (chars > MAX_CACHED_BUNDLE_CHARS) return null
    out[path] = b64
  }
  return { files: out }
}

function decodeBundle(record: BundleRecord): BundleFiles {
  const out: BundleFiles = {}
  for (const [path, b64] of Object.entries(record.files)) {
    out[path] = new Uint8Array(Buffer.from(b64, 'base64'))
  }
  return out
}

export function createSnapshotStore(opts: StoreOptions): SnapshotStore {
  const source = opts.source
  const cache = opts.cache ?? null
  const cacheTtl = opts.cacheTtl ?? 60 * 60 * 24
  const memoTtl = opts.memoTtl ?? 60_000
  const now = opts.now ?? Date.now

  let manifests: ManifestRecord | null = null
  let manifestsAt = 0
  let files: Record<string, BundleFiles> = {}
  let inflight: Promise<Snapshot> | null = null

  async function writeCache(snap: Snapshot, record: ManifestRecord): Promise<void> {
    if (!cache) return
    await cache.set(MANIFEST_KEY, record, { ttl: cacheTtl, tags: [CACHE_TAG] })
    for (const [slug, bundle] of Object.entries(snap.files)) {
      const encoded = encodeBundle(bundle)
      if (encoded) await cache.set(bundleKey(slug), encoded, { ttl: cacheTtl, tags: [CACHE_TAG] })
    }
  }

  function loadFromSource(): Promise<Snapshot> {
    if (!inflight) {
      inflight = source.load()
        .then(async (snap) => {
          const record: ManifestRecord = { meta: pickMeta(snap), skills: snap.skills }
          manifests = record
          manifestsAt = now()
          files = snap.files
          await writeCache(snap, record)
          return snap
        })
        .finally(() => {
          inflight = null
        })
    }
    return inflight
  }

  async function readCachedManifests(): Promise<ManifestRecord | null> {
    if (!cache) return null
    const hit = await cache.get(MANIFEST_KEY) as ManifestRecord | null
    return hit && Array.isArray(hit.skills) && hit.meta ? hit : null
  }

  async function getManifests(): Promise<ManifestRecord> {
    if (!cache) {
      await loadFromSource()
      return manifests!
    }
    if (manifests && now() - manifestsAt < memoTtl) return manifests
    const cached = await readCachedManifests()
    if (cached) {
      if (manifests && cached.meta.sha !== manifests.meta.sha) files = {}
      manifests = cached
      manifestsAt = now()
      return cached
    }
    await loadFromSource()
    return manifests!
  }

  async function getBundleFiles(slug: string): Promise<BundleFiles | null> {
    const { skills } = await getManifests()
    if (!skills.some(s => s.slug === slug)) return null
    if (files[slug]) return files[slug]!
    if (cache) {
      const record = await cache.get(bundleKey(slug)) as BundleRecord | null
      if (record && record.files) {
        files[slug] = decodeBundle(record)
        return files[slug]!
      }
    }
    const snap = await loadFromSource()
    return snap.files[slug] ?? null
  }

  async function refresh(): Promise<SnapshotMeta> {
    manifests = null
    manifestsAt = 0
    files = {}
    const snap = await loadFromSource()
    return pickMeta(snap)
  }

  return { getManifests, getBundleFiles, refresh }
}
