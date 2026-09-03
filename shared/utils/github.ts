export interface GithubRef {
  owner: string
  repo: string
  branch: string
}

export function githubRepoUrl(ref: GithubRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}`
}

export function githubTreeUrl(ref: GithubRef, slug: string): string {
  return `${githubRepoUrl(ref)}/tree/${ref.branch}/skills/${slug}`
}

export function githubBlobUrl(ref: GithubRef, slug: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${githubRepoUrl(ref)}/blob/${ref.branch}/skills/${slug}/${encoded}`
}
