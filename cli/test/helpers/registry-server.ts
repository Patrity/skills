import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { zipSync } from 'fflate'
import { fixtureManifest, zipFixtureBundle } from './fixtures'

const encoder = new TextEncoder()

/** Slugs the fixture manifest advertises; anything else is a 404 the client turns into a RegistryError. */
const BUNDLES = new Set(['demo', 'second', 'third'])

/**
 * `second` and `third` ship nothing installable: a README (skipped like every bundle README) and a
 * one-line CLAUDE.md, so their only trace in a project is a marker block.
 */
function minimalBundle(slug: string): Uint8Array {
  return zipSync({
    [`${slug}/README.md`]: encoder.encode(`---\nname: ${slug}\ndescription: fixture bundle\ntags: [fixture]\n---\n\n# ${slug}\n`),
    [`${slug}/CLAUDE.md`]: encoder.encode(`## Skills and rules\n- ${slug}\n`)
  })
}

export interface FakeRegistry {
  url: string
  close: () => Promise<void>
}

/**
 * A throwaway registry on a random port, serving the two endpoints the CLI calls:
 * `/api/cli/manifest` and `/api/skills/<slug>/download`.
 */
export async function startRegistry(): Promise<FakeRegistry> {
  let url = ''
  const server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0] ?? ''
    if (path === '/api/cli/manifest') {
      // The manifest advertises its own origin, so a lockfile written from it points back here.
      const body = JSON.stringify({ ...fixtureManifest(), registry: url })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(body)
      return
    }
    const download = /^\/api\/skills\/([^/]+)\/download$/.exec(path)
    if (download) {
      const slug = decodeURIComponent(download[1]!)
      if (BUNDLES.has(slug)) {
        const zip = slug === 'demo' ? zipFixtureBundle(slug) : minimalBundle(slug)
        res.writeHead(200, { 'content-type': 'application/zip' })
        res.end(Buffer.from(zip))
        return
      }
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end('{"error":"not found"}')
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  return {
    url,
    close: () => new Promise<void>((resolve, reject) => {
      // fetch keeps sockets alive; without this the close callback never fires.
      server.closeAllConnections()
      server.close(err => (err ? reject(err) : resolve()))
    })
  }
}
