import type { SkillsSource } from './types'
import { buildSnapshot } from './parse-bundle'
import { extractArchive } from './archive'

export interface GithubSourceOptions {
  owner: string
  repo: string
  branch: string
  token?: string
  fetchImpl?: typeof fetch
}

interface CommitResponse {
  sha: string
  commit: { committer: { date: string } }
}

/** Production source: branch-head lookup, then the repo zipball at that sha. */
export function createGithubSource(opts: GithubSourceOptions): SkillsSource {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const base = `https://api.github.com/repos/${opts.owner}/${opts.repo}`
  const headers: Record<string, string> = {
    'accept': 'application/vnd.github+json',
    'user-agent': 'skills-site (+https://github.com/Patrity/skills)',
    'x-github-api-version': '2022-11-28'
  }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`

  async function get(url: string): Promise<Response> {
    // A hung GitHub request must fail fast: the store keeps serving its stale
    // snapshot, and a slow 5xx would otherwise burn the whole function timeout.
    const res = await fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`github: ${res.status} ${url}`)
    return res
  }

  return {
    async load() {
      const fetchedAt = new Date().toISOString()
      const head = await (await get(`${base}/commits/${opts.branch}`)).json() as CommitResponse
      const zip = await (await get(`${base}/zipball/${head.sha}`)).arrayBuffer()
      const { bundles, extras } = extractArchive(zip)
      // An empty result means a truncated/unexpected archive, not an empty repo:
      // throwing keeps the previous snapshot in place instead of blanking the site.
      if (bundles.length === 0) throw new Error(`github: archive ${head.sha} has no skills/ bundles`)
      return buildSnapshot(bundles, {
        sha: head.sha,
        committedAt: new Date(head.commit.committer.date).toISOString(),
        fetchedAt,
        source: 'github'
      }, extras)
    }
  }
}
