import { describe, expect, it } from 'vitest'
import { bundleKey, CACHE_TAG, createSnapshotStore, MANIFEST_KEY, type StoreCache } from '../../server/lib/skills/store'
import type { Snapshot, SkillsSource } from '../../server/lib/skills/types'
import { MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'

const enc = (s: string) => new TextEncoder().encode(s)

function snapshot(sha: string, extraFiles: Record<string, Uint8Array> = {}): Snapshot {
  return {
    sha,
    committedAt: '2026-09-03T00:00:00.000Z',
    fetchedAt: '2026-09-03T00:00:01.000Z',
    source: 'github',
    skills: [{
      slug: 'demo', name: 'Demo', description: 'd', tags: ['t'], author: 'a',
      badges: [], fileCount: 1, totalBytes: 5, errors: [],
      tree: [{ name: 'README.md', path: 'README.md', type: 'file', size: 5, kind: 'text' }]
    }],
    files: { demo: { 'README.md': enc('hello'), ...extraFiles } }
  }
}

function fakeSource(snaps: Snapshot[]): SkillsSource & { calls: number } {
  let i = 0
  const src = {
    calls: 0,
    async load() {
      src.calls++
      const s = snaps[Math.min(i, snaps.length - 1)]!
      i++
      return s
    }
  }
  return src
}

function fakeCache(): StoreCache & { store: Map<string, { value: unknown, tags: string[], ttl?: number }>, gets: number } {
  const store = new Map<string, { value: unknown, tags: string[], ttl?: number }>()
  return {
    store,
    gets: 0,
    async get(key) {
      this.gets++
      return store.has(key) ? JSON.parse(JSON.stringify(store.get(key)!.value)) : null
    },
    async set(key, value, options) {
      store.set(key, { value: JSON.parse(JSON.stringify(value)), tags: options?.tags ?? [], ttl: options?.ttl })
    }
  }
}

/** Serves `snap` until `fail()` is called, then rejects every load. */
function flakySource(snap: Snapshot): SkillsSource & { calls: number, fail: () => void } {
  let broken = false
  const src = {
    calls: 0,
    fail() {
      broken = true
    },
    async load() {
      src.calls++
      if (broken) throw new Error('source down')
      return snap
    }
  }
  return src
}

describe('createSnapshotStore without a cache (fs/dev)', () => {
  it('reloads from the source on every manifest read', async () => {
    const source = fakeSource([snapshot('a')])
    const store = createSnapshotStore({ source })
    await store.getManifests()
    await store.getManifests()
    expect(source.calls).toBe(2)
  })

  it('serves bundle files from the loaded snapshot', async () => {
    const store = createSnapshotStore({ source: fakeSource([snapshot('a')]) })
    const files = await store.getBundleFiles('demo')
    expect(new TextDecoder().decode(files!['README.md'])).toBe('hello')
    expect(await store.getBundleFiles('missing')).toBeNull()
  })
})

describe('createSnapshotStore with a cache (Vercel)', () => {
  it('cold start loads once, writes tagged manifest + bundle entries, then serves from memo', async () => {
    const source = fakeSource([snapshot('a')])
    const cache = fakeCache()
    const store = createSnapshotStore({ source, cache, cacheTtl: 123 })
    const first = await store.getManifests()
    expect(first.meta.sha).toBe('a')
    expect(source.calls).toBe(1)
    expect(cache.store.get(MANIFEST_KEY)).toMatchObject({ tags: [CACHE_TAG], ttl: 123 })
    expect(cache.store.get(bundleKey('demo'))).toMatchObject({ tags: [CACHE_TAG], ttl: 123 })

    cache.gets = 0
    await store.getManifests()
    await store.getBundleFiles('demo')
    expect(source.calls).toBe(1)
    expect(cache.gets).toBe(0)
  })

  it('a fresh instance warms from the cache without touching the source', async () => {
    const cache = fakeCache()
    await createSnapshotStore({ source: fakeSource([snapshot('a')]), cache }).getManifests()

    const source2 = fakeSource([snapshot('b')])
    const store2 = createSnapshotStore({ source: source2, cache })
    expect((await store2.getManifests()).meta.sha).toBe('a')
    const files = await store2.getBundleFiles('demo')
    expect(new TextDecoder().decode(files!['README.md'])).toBe('hello')
    expect(source2.calls).toBe(0)
  })

  it('collapses concurrent cold loads into one source call', async () => {
    const source = fakeSource([snapshot('a')])
    const store = createSnapshotStore({ source, cache: fakeCache() })
    await Promise.all([store.getManifests(), store.getManifests(), store.getBundleFiles('demo')])
    expect(source.calls).toBe(1)
  })

  it('skips caching bundles that would exceed the item size limit and reloads them from source', async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 512 * 1024).fill(0x61)
    const cache = fakeCache()
    const source = fakeSource([snapshot('a', { 'big.txt': big })])
    await createSnapshotStore({ source, cache }).getManifests()
    expect(cache.store.has(bundleKey('demo'))).toBe(false)

    const source2 = fakeSource([snapshot('a', { 'big.txt': big })])
    const store2 = createSnapshotStore({ source: source2, cache })
    const files = await store2.getBundleFiles('demo')
    expect(files!['big.txt']!.byteLength).toBe(big.byteLength)
    expect(source2.calls).toBe(1)
  })

  it('re-reads the cached manifest after memoTtl and adopts a newer sha', async () => {
    let t = 1_000_000
    const now = () => t
    const cache = fakeCache()
    const store = createSnapshotStore({ source: fakeSource([snapshot('a')]), cache, memoTtl: 1000, now })
    await store.getManifests()

    // Another instance refreshed the cache with sha "b" and a different README.
    const other = createSnapshotStore({ source: fakeSource([snapshot('b', { 'README.md': enc('newer') })]), cache, now })
    await other.refresh()

    expect((await store.getManifests()).meta.sha).toBe('a') // memo still trusted
    t += 1001
    expect((await store.getManifests()).meta.sha).toBe('b')
    const files = await store.getBundleFiles('demo')
    expect(new TextDecoder().decode(files!['README.md'])).toBe('newer')
  })

  it('refresh() forces a source reload and returns the new meta', async () => {
    const source = fakeSource([snapshot('a'), snapshot('b')])
    const cache = fakeCache()
    const store = createSnapshotStore({ source, cache })
    await store.getManifests()
    const meta = await store.refresh()
    expect(meta.sha).toBe('b')
    expect(source.calls).toBe(2)
    expect((cache.store.get(MANIFEST_KEY)!.value as { meta: { sha: string } }).meta.sha).toBe('b')
  })

  it('returns null for an unknown slug without hitting the source again', async () => {
    const source = fakeSource([snapshot('a')])
    const store = createSnapshotStore({ source, cache: fakeCache() })
    await store.getManifests()
    expect(await store.getBundleFiles('nope')).toBeNull()
    expect(source.calls).toBe(1)
  })
})

describe('createSnapshotStore when the source fails', () => {
  it('rejects on a cold miss with nothing to serve', async () => {
    const source = flakySource(snapshot('a'))
    source.fail()
    await expect(createSnapshotStore({ source }).getManifests()).rejects.toThrow('source down')
  })

  it('serves the stale memo once a snapshot has been loaded', async () => {
    const source = flakySource(snapshot('a'))
    const store = createSnapshotStore({ source })
    expect((await store.getManifests()).meta.sha).toBe('a')
    source.fail()
    expect((await store.getManifests()).meta.sha).toBe('a')
    const files = await store.getBundleFiles('demo')
    expect(new TextDecoder().decode(files!['README.md'])).toBe('hello')
  })

  it('keeps the previous snapshot when refresh() fails', async () => {
    const source = flakySource(snapshot('a'))
    const store = createSnapshotStore({ source })
    await store.getManifests()
    source.fail()
    await expect(store.refresh()).rejects.toThrow('source down')
    expect((await store.getManifests()).meta.sha).toBe('a')
  })

  it('rejects on a cold miss with a cache configured but empty', async () => {
    const source = flakySource(snapshot('a'))
    source.fail()
    await expect(createSnapshotStore({ source, cache: fakeCache() }).getManifests()).rejects.toThrow('source down')
  })
})
