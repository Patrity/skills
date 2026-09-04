import { unzipSync } from 'fflate'
import type { CliManifest } from '../../shared/types/setup'
import { isSafeBundlePath } from '../../shared/setup/paths'
import { CLI_VERSION } from './version'

export type BundleFiles = Record<string, Uint8Array>

export { isSafeBundlePath }

/**
 * The two fields every caller walks unconditionally. A host that answers `/api/cli/manifest` with
 * something else (an HTML error page served as JSON, another API) must fail here, not with a
 * `TypeError` three frames deeper.
 */
function isManifest(value: unknown): value is CliManifest {
  if (typeof value !== 'object' || value === null) return false
  const m = value as { skills?: unknown, errors?: unknown }
  return Array.isArray(m.skills) && Array.isArray(m.errors)
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
      let body: unknown
      try {
        body = await res.json()
      } catch (err) {
        throw new RegistryError(`registry returned an unreadable manifest from ${url}: ${(err as Error).message}`, url)
      }
      if (!isManifest(body)) throw new RegistryError(`registry returned an unexpected manifest shape from ${url}`, url)
      const manifest = body
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
