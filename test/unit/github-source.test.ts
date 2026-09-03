import { describe, expect, it, vi } from 'vitest'
import { createTarGzip } from 'nanotar'
import { createGithubSource } from '../../server/lib/skills/github-source'

const readme = '---\nname: Nuxt\ndescription: d\ntags: [nuxt]\nauthor: a\n---\n'

function fakeFetch(opts: { commitStatus?: number, tarStatus?: number } = {}) {
  const calls: { url: string, headers: Record<string, string> }[] = []
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) })
    if (url.includes('/commits/')) {
      return new Response(JSON.stringify({ sha: 'deadbeefcafe', commit: { committer: { date: '2026-09-03T12:00:00Z' } } }), {
        status: opts.commitStatus ?? 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    if (url.includes('/tarball/')) {
      const tgz = await createTarGzip([{ name: 'Patrity-skills-deadbee/skills/nuxt/README.md', data: readme }])
      return new Response(tgz, { status: opts.tarStatus ?? 200 })
    }
    return new Response('not found', { status: 404 })
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

describe('createGithubSource', () => {
  it('looks up the branch head, downloads the tarball at that sha, and builds a snapshot', async () => {
    const { impl, calls } = fakeFetch()
    const snap = await createGithubSource({ owner: 'Patrity', repo: 'skills', branch: 'main', fetchImpl: impl }).load()
    expect(calls[0]!.url).toBe('https://api.github.com/repos/Patrity/skills/commits/main')
    expect(calls[1]!.url).toBe('https://api.github.com/repos/Patrity/skills/tarball/deadbeefcafe')
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

  it('throws on a non-2xx commit lookup', async () => {
    const { impl } = fakeFetch({ commitStatus: 403 })
    await expect(createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load())
      .rejects.toThrow(/github: 403/)
  })

  it('throws on a non-2xx tarball download', async () => {
    const { impl } = fakeFetch({ tarStatus: 500 })
    await expect(createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load())
      .rejects.toThrow(/github: 500/)
  })
})
