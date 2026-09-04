import type { SkillManifest, SnapshotMeta } from '../../../shared/types/skills'
import type { BaseSchema, Profile } from '../../../shared/types/setup'
import type { BundleFiles, SkillsSource, Snapshot } from './types'

/** Structurally matches `RuntimeCache` from @vercel/functions. */
export interface StoreCache {
  get(key: string): Promise<unknown | null>
  set(key: string, value: unknown, options?: { ttl?: number, tags?: string[] }): Promise<void>
}

export interface ManifestRecord {
  meta: SnapshotMeta
  skills: SkillManifest[]
  base: BaseSchema | null
  baseErrors: string[]
  profiles: Profile[]
  profileErrors: string[]
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

/** Guards against a cache entry written by an older/incompatible build of this store. */
function isValidManifestRecord(hit: unknown): hit is ManifestRecord {
  if (!hit || typeof hit !== 'object') return false
  const { meta, skills, profiles, baseErrors } = hit as { meta?: unknown, skills?: unknown, profiles?: unknown, baseErrors?: unknown }
  if (!meta || typeof meta !== 'object') return false
  const m = meta as Record<string, unknown>
  if (typeof m.sha !== 'string' || typeof m.committedAt !== 'string' || typeof m.fetchedAt !== 'string') return false
  if (m.source !== 'fs' && m.source !== 'github') return false
  if (!Array.isArray(skills)) return false
  if (!Array.isArray(profiles)) return false
  if (!Array.isArray(baseErrors)) return false
  return skills.every((s) => {
    if (!s || typeof s !== 'object') return false
    const skill = s as Record<string, unknown>
    return typeof skill.slug === 'string' && Array.isArray(skill.tree)
  })
}

/**
 * A Runtime Cache outage must never take the site down: any failure here is treated as
 * a miss (get) or silently dropped (set), falling through to the source instead of
 * throwing. `cacheWarned` keeps that from spamming the logs on every request during a
 * sustained outage: only the first failure since the last successful cache call warns.
 */
let cacheWarned = false

function warnCacheFailure(err: unknown): void {
  if (cacheWarned) return
  cacheWarned = true
  console.warn('[skills] runtime cache unavailable:', err instanceof Error ? err.message : String(err))
}

async function safeCacheGet(cache: StoreCache, key: string): Promise<unknown | null> {
  try {
    const result = await cache.get(key)
    cacheWarned = false
    return result
  } catch (err) {
    warnCacheFailure(err)
    return null
  }
}

async function safeCacheSet(cache: StoreCache, key: string, value: unknown, options?: { ttl?: number, tags?: string[] }): Promise<void> {
  try {
    await cache.set(key, value, options)
    cacheWarned = false
  } catch (err) {
    warnCacheFailure(err)
  }
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
    await safeCacheSet(cache, MANIFEST_KEY, record, { ttl: cacheTtl, tags: [CACHE_TAG] })
    await Promise.all(Object.entries(snap.files).map(([slug, bundle]) => {
      const encoded = encodeBundle(bundle)
      return encoded ? safeCacheSet(cache, bundleKey(slug), encoded, { ttl: cacheTtl, tags: [CACHE_TAG] }) : undefined
    }))
  }

  function loadFromSource(): Promise<Snapshot> {
    if (!inflight) {
      inflight = source.load()
        .then(async (snap) => {
          const record: ManifestRecord = {
            meta: pickMeta(snap),
            skills: snap.skills,
            base: snap.base,
            baseErrors: snap.baseErrors,
            profiles: snap.profiles,
            profileErrors: snap.profileErrors
          }
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
    const hit = await safeCacheGet(cache, MANIFEST_KEY)
    return isValidManifestRecord(hit) ? hit : null
  }

  /**
   * A source failure must never blank the site: if we already hold a snapshot we keep
   * serving it (stale) and retry on the next request. Only a cold instance rethrows,
   * so the route layer can answer 503 rather than a cacheable 404/200.
   */
  async function loadOrStale(): Promise<ManifestRecord> {
    try {
      await loadFromSource()
      return manifests!
    } catch (err) {
      if (manifests) return manifests
      throw err
    }
  }

  async function getManifests(): Promise<ManifestRecord> {
    if (!cache) return loadOrStale()
    if (manifests && now() - manifestsAt < memoTtl) return manifests
    const cached = await readCachedManifests()
    if (cached) {
      if (manifests && cached.meta.sha !== manifests.meta.sha) files = {}
      manifests = cached
      manifestsAt = now()
      return cached
    }
    return loadOrStale()
  }

  async function getBundleFiles(slug: string): Promise<BundleFiles | null> {
    const { skills } = await getManifests()
    if (!skills.some(s => s.slug === slug)) return null
    if (files[slug]) return files[slug]!
    if (cache) {
      const record = await safeCacheGet(cache, bundleKey(slug)) as BundleRecord | null
      if (record && record.files) {
        files[slug] = decodeBundle(record)
        return files[slug]!
      }
    }
    const snap = await loadFromSource()
    return snap.files[slug] ?? null
  }

  /**
   * Always hits the source. State is swapped only once the load resolves (inside
   * `loadFromSource`), so a failed refresh leaves the previous snapshot serving.
   */
  async function refresh(): Promise<SnapshotMeta> {
    const snap = await loadFromSource()
    return pickMeta(snap)
  }

  return { getManifests, getBundleFiles, refresh }
}
