import type { SkillsSource } from './types'
import { buildSnapshot } from './parse-bundle'
import { extractBundles } from './tarball'

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

/** Production source: branch-head lookup, then the repo tarball at that sha. */
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
    const res = await fetchImpl(url, { headers, redirect: 'follow' })
    if (!res.ok) throw new Error(`github: ${res.status} ${url}`)
    return res
  }

  return {
    async load() {
      const fetchedAt = new Date().toISOString()
      const commit = await (await get(`${base}/commits/${opts.branch}`)).json() as CommitResponse
      const tgz = await (await get(`${base}/tarball/${commit.sha}`)).arrayBuffer()
      const bundles = await extractBundles(tgz)
      return buildSnapshot(bundles, {
        sha: commit.sha,
        committedAt: new Date(commit.commit.committer.date).toISOString(),
        fetchedAt,
        source: 'github'
      })
    }
  }
}
