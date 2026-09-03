import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { RawBundle, SkillsSource } from './types'
import { buildSnapshot } from './parse-bundle'
import { isExcludedPath } from './exclusions'

async function walk(dir: string, root: string, out: { rel: string, abs: string }[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    const rel = relative(root, abs).split('\\').join('/')
    if (isExcludedPath(rel)) continue
    if (entry.isDirectory()) await walk(abs, root, out)
    else if (entry.isFile()) out.push({ rel, abs })
  }
}

/** Reads `<dir>/<slug>/**` from disk. Dev/CI source; zero network. */
export function createFsSource(dir: string): SkillsSource {
  const root = resolve(dir)
  return {
    async load() {
      const fetchedAt = new Date().toISOString()
      let slugs: string[]
      try {
        slugs = (await readdir(root, { withFileTypes: true }))
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => e.name)
          .sort()
      } catch {
        slugs = []
      }

      const hash = createHash('sha1')
      let newest = 0
      const bundles: RawBundle[] = []
      for (const slug of slugs) {
        const bundleRoot = join(root, slug)
        const found: { rel: string, abs: string }[] = []
        await walk(bundleRoot, bundleRoot, found)
        const files: Record<string, Uint8Array> = {}
        for (const f of found.sort((a, b) => a.rel.localeCompare(b.rel))) {
          const [bytes, info] = await Promise.all([readFile(f.abs), stat(f.abs)])
          files[f.rel] = new Uint8Array(bytes)
          hash.update(`${slug}/${f.rel}:${info.size}:${info.mtimeMs}\n`)
          if (info.mtimeMs > newest) newest = info.mtimeMs
        }
        bundles.push({ slug, files })
      }

      return buildSnapshot(bundles, {
        sha: `fs-${hash.digest('hex').slice(0, 12)}`,
        committedAt: new Date(newest || Date.now()).toISOString(),
        fetchedAt,
        source: 'fs'
      })
    }
  }
}
