import { describe, expect, it, vi } from 'vitest'
import { zipSync } from 'fflate'
import { createGithubSource } from '../../server/lib/skills/github-source'

const readme = '---\nname: Nuxt\ndescription: d\ntags: [nuxt]\nauthor: a\n---\n'
const enc = (s: string) => new TextEncoder().encode(s)

function fakeFetch(opts: { commitStatus?: number, zipStatus?: number, files?: Record<string, Uint8Array> } = {}) {
  const calls: { url: string, headers: Record<string, string>, signal?: AbortSignal | null }[] = []
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()), signal: init?.signal })
    if (url.includes('/commits/')) {
      return new Response(JSON.stringify({ sha: 'deadbeefcafe', commit: { committer: { date: '2026-09-03T12:00:00Z' } } }), {
        status: opts.commitStatus ?? 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    if (url.includes('/zipball/')) {
      const zip = zipSync(opts.files ?? { 'Patrity-skills-deadbee/skills/nuxt/README.md': enc(readme) })
      return new Response(zip, { status: opts.zipStatus ?? 200 })
    }
    return new Response('not found', { status: 404 })
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

describe('createGithubSource', () => {
  it('looks up the branch head, downloads the zipball at that sha, and builds a snapshot', async () => {
    const { impl, calls } = fakeFetch()
    const snap = await createGithubSource({ owner: 'Patrity', repo: 'skills', branch: 'main', fetchImpl: impl }).load()
    expect(calls.length).toBe(2)
    expect(calls[0]!.url).toBe('https://api.github.com/repos/Patrity/skills/commits/main')
    expect(calls[0]!.headers['x-github-api-version']).toBe('2022-11-28')
    expect(calls[1]!.url).toBe('https://api.github.com/repos/Patrity/skills/zipball/deadbeefcafe')
    expect(snap).toMatchObject({ sha: 'deadbeefcafe', committedAt: '2026-09-03T12:00:00.000Z', source: 'github' })
    expect(snap.skills.map(s => s.slug)).toEqual(['nuxt'])
    expect(snap.skills[0]!.errors).toEqual([])
  })

  it('sends the bearer token and GitHub headers when a token is configured', async () => {
    const { impl, calls } = fakeFetch()
    await createGithubSource({ owner: 'o', repo: 'r', branch: 'b', token: 'tok', fetchImpl: impl }).load()
    expect(calls[0]!.headers.authorization).toBe('Bearer tok')
    expect(calls[0]!.headers.accept).toBe('application/vnd.github+json')
    expect(calls[0]!.headers['user-agent']).toMatch(/skills/)
  })

  it('omits authorization without a token', async () => {
    const { impl, calls } = fakeFetch()
    await createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load()
    expect(calls[0]!.headers.authorization).toBeUndefined()
  })

  it('bounds every request with an abort signal so a hung GitHub call fails fast', async () => {
    const { impl, calls } = fakeFetch()
    await createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load()
    expect(calls.every(c => c.signal instanceof AbortSignal)).toBe(true)
  })

  it('throws on a non-2xx commit lookup', async () => {
    const { impl } = fakeFetch({ commitStatus: 403 })
    await expect(createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load())
      .rejects.toThrow(/github: 403/)
  })

  it('throws on a non-2xx zipball download', async () => {
    const { impl } = fakeFetch({ zipStatus: 500 })
    await expect(createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load())
      .rejects.toThrow(/github: 500/)
  })

  it('throws when the archive contains no skills/ bundles', async () => {
    const { impl } = fakeFetch({ files: { 'Patrity-skills-deadbee/README.md': enc('root') } })
    await expect(createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load())
      .rejects.toThrow(/github: archive deadbeefcafe has no skills\/ bundles/)
  })
})
