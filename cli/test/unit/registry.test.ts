import { describe, expect, it, vi } from 'vitest'
import { zipSync } from 'fflate'
import { createRegistryClient, RegistryError } from '../../src/registry'
import { fixtureManifest, zipFixtureBundle } from '../helpers/fixtures'

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init)) as unknown as typeof fetch
}

describe('createRegistryClient', () => {
  it('fetches the manifest with the CLI user agent', async () => {
    const seen: Record<string, string> = {}
    const client = createRegistryClient('http://registry.test/', {
      version: '9.9.9',
      fetchImpl: fakeFetch((url, init) => {
        seen.url = url
        seen.ua = new Headers(init?.headers).get('user-agent') ?? ''
        return Response.json(fixtureManifest())
      })
    })
    const m = await client.manifest()
    expect(seen.url).toBe('http://registry.test/api/cli/manifest')
    expect(seen.ua).toBe('@patrity/skills/9.9.9')
    expect(m.skills.map(s => s.slug)).toEqual(['demo', 'second', 'third'])
    expect(client.registry).toBe('http://registry.test')
  })

  it('rejects a manifest whose base has errors', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => Response.json({ ...fixtureManifest(), errors: ['axis "pm": bad'] })) })
    await expect(client.manifest()).rejects.toThrow(/base schema has errors: axis "pm": bad/)
  })

  it('downloads and unpacks a bundle rooted at <slug>/', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => new Response(zipFixtureBundle('demo'))) })
    const files = await client.download('demo')
    expect(Object.keys(files).sort()).toEqual(['CLAUDE.md', 'README.md', 'hooks/pre-commit.sh', 'rules/demo.md', 'settings.json', 'skills/demo-skill/SKILL.md'])
    expect(new TextDecoder().decode(files['rules/demo.md'])).toContain('{{appDir}}')
  })

  it('drops zip entries whose name escapes the bundle root', async () => {
    const enc = new TextEncoder()
    const zip = zipSync({
      'demo/rules/ok.md': enc.encode('ok'),
      'demo/../../.ssh/authorized_keys': enc.encode('pwned'),
      'demo/../evil.md': enc.encode('pwned')
    })
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => new Response(zip)) })
    expect(Object.keys(await client.download('demo'))).toEqual(['rules/ok.md'])
  })

  it('turns non-2xx into RegistryError with status and url', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => new Response('nope', { status: 503 })) })
    await expect(client.download('demo')).rejects.toMatchObject({ name: 'RegistryError', status: 503, url: 'http://registry.test/api/skills/demo/download' })
    expect(await client.download('demo').catch(e => e instanceof RegistryError)).toBe(true)
  })

  it('turns a malformed manifest body into a RegistryError naming the url', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => new Response('not json')) })
    await expect(client.manifest()).rejects.toMatchObject({ name: 'RegistryError', url: 'http://registry.test/api/cli/manifest' })
    await expect(client.manifest()).rejects.toThrow(/http:\/\/registry\.test\/api\/cli\/manifest/)
  })

  it('rejects a body that parses but is not a manifest', async () => {
    const bodies: unknown[] = [{ hello: 'world' }, [], null, { ...fixtureManifest(), skills: 'nope' }, { ...fixtureManifest(), errors: undefined }]
    for (const body of bodies) {
      const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => Response.json(body)) })
      await expect(client.manifest({ allowErrors: true })).rejects.toThrow(/unexpected manifest shape from http:\/\/registry\.test\/api\/cli\/manifest/)
    }
  })

  it('turns a corrupt bundle zip into a RegistryError naming the slug and url', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => new Response(new Uint8Array([1, 2, 3, 4]))) })
    await expect(client.download('demo')).rejects.toMatchObject({ name: 'RegistryError', url: 'http://registry.test/api/skills/demo/download' })
    await expect(client.download('demo')).rejects.toThrow(/"demo".*http:\/\/registry\.test\/api\/skills\/demo\/download/)
  })
})
