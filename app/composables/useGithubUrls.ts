import { githubBlobUrl, githubRepoUrl, githubTreeUrl } from '~~/shared/utils/github'

export function useGithubUrls() {
  const ref = useRuntimeConfig().public.github
  return {
    repo: githubRepoUrl(ref),
    tree: (slug: string) => githubTreeUrl(ref, slug),
    blob: (slug: string, path: string) => githubBlobUrl(ref, slug, path)
  }
}
