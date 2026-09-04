import { posix as pathPosix } from 'node:path'
import { unzipSync } from 'fflate'
import type { CliManifest } from '../../shared/types/setup'
import { CLI_VERSION } from './version'

export type BundleFiles = Record<string, Uint8Array>

/**
 * A bundle entry may only name a file inside the bundle: no absolute path, no `..` segment, no
 * backslash, and nothing whose normalized form climbs out. Everything downstream joins these onto
 * the project directory, so an escaping name would write outside it.
 */
export function isSafeBundlePath(rel: string): boolean {
  if (rel === '' || rel.startsWith('/') || /^[A-Za-z]:/.test(rel) || rel.includes('\\')) return false
  if (rel.split('/').includes('..')) return false
  return !pathPosix.normalize(`x/${rel}`).startsWith('..')
}

export class RegistryError extends Error {
  name = 'RegistryError'
  constructor(message: string, public url: string, public status?: number) {
    super(message)
  }
}

export interface RegistryClient {
  registry: string
  manifest(opts?: { allowErrors?: boolean }): Promise<CliManifest>
  download(slug: string): Promise<BundleFiles>
}

export function createRegistryClient(registry: string, opts: { fetchImpl?: typeof fetch, version?: string } = {}): RegistryClient {
  const base = registry.replace(/\/+$/, '')
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const headers = { 'user-agent': `@patrity/skills/${opts.version ?? CLI_VERSION}`, 'accept': 'application/json, application/zip' }

  async function get(path: string): Promise<Response> {
    const url = `${base}${path}`
    let res: Response
    try {
      res = await fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30_000) })
    } catch (err) {
      throw new RegistryError(`registry unreachable: ${(err as Error).message}`, url)
    }
    if (!res.ok) throw new RegistryError(`registry returned ${res.status} for ${url}`, url, res.status)
    return res
  }

  return {
    registry: base,
    async manifest({ allowErrors = false } = {}) {
      const url = `${base}/api/cli/manifest`
      const res = await get('/api/cli/manifest')
      let manifest: CliManifest
      try {
        manifest = await res.json() as CliManifest
      } catch (err) {
        throw new RegistryError(`registry returned an unreadable manifest from ${url}: ${(err as Error).message}`, url)
      }
      if (!allowErrors && manifest.errors.length) {
        throw new RegistryError(`registry base schema has errors: ${manifest.errors.join('; ')}`, url)
      }
      return manifest
    },
    async download(slug) {
      const url = `${base}/api/skills/${encodeURIComponent(slug)}/download`
      const bytes = new Uint8Array(await (await get(`/api/skills/${encodeURIComponent(slug)}/download`)).arrayBuffer())
      let entries: ReturnType<typeof unzipSync>
      try {
        entries = unzipSync(bytes, { filter: f => !f.name.endsWith('/') })
      } catch (err) {
        throw new RegistryError(`registry returned an unreadable bundle zip for "${slug}" from ${url}: ${(err as Error).message}`, url)
      }
      const files: BundleFiles = {}
      const prefix = `${slug}/`
      for (const [name, data] of Object.entries(entries)) {
        if (!name.startsWith(prefix)) continue
        const rel = name.slice(prefix.length)
        if (!isSafeBundlePath(rel)) continue // a zip entry must not escape the bundle root
        files[rel] = data
      }
      return files
    }
  }
}
