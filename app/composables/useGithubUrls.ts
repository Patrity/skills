import { githubBlobUrl, githubRepoUrl, githubTreeUrl } from '~~/shared/utils/github'

export function useGithubUrls() {
  const github = useRuntimeConfig().public.github
  return {
    repo: githubRepoUrl(github),
    tree: (slug: string) => githubTreeUrl(github, slug),
    blob: (slug: string, path: string) => githubBlobUrl(github, slug, path)
  }
}
