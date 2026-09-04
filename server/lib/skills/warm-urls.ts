import type { SkillDetailResponse, TreeNode } from '../../../shared/types/skills'

/**
 * A `<loc>` carries the origin from NUXT_PUBLIC_SITE_URL, which is not necessarily the host
 * being warmed (a local prod run serves :3100 while the sitemap still says :3000), so keep
 * the path and throw the origin away.
 */
function pathOf(loc: string): string {
  const match = /^https?:\/\/[^/]*(\/.*)?$/.exec(loc.trim())
  return match ? (match[1] || '/') : loc.trim()
}

/** Percent-encode each segment but leave the separators alone. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function filePaths(nodes: TreeNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === 'file') out.push(node.path)
    if (node.children) filePaths(node.children, out)
  }
  return out
}

/**
 * Every site-relative URL worth warming after a purge or a deploy, in fetch order.
 *
 * `buildId` comes from `/_nuxt/builds/latest.json`. It matters: a Vercel ISR cache key
 * INCLUDES the query string (no `allowQuery` is emitted), and client-side navigation always
 * asks for `<route>/_payload.json?_b=<buildId>`, so warming the bare URL fills an entry no
 * browser ever requests. Omit it only when the id cannot be read.
 *
 * `/sitemap.xml`, `/api/skills` and `/api/skills/<slug>` are absent on purpose: the caller
 * has to fetch those to build this list, which warms them already.
 */
export function buildWarmUrls(sitemapXml: string, details: SkillDetailResponse[], buildId?: string): string[] {
  const urls = new Set<string>(['/api/base', '/api/profiles', '/api/cli/manifest'])
  const query = buildId ? `?_b=${encodeURIComponent(buildId)}` : ''
  // The site root's payload is /_payload.json, not //_payload.json.
  const payload = (path: string) => `${path === '/' ? '' : path}/_payload.json${query}`

  // The builder page: nothing in the sitemap links to it (it is not a bundle or doc page).
  urls.add('/build')
  urls.add(payload('/build'))

  const paths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => pathOf(m[1]!))
  for (const path of paths) {
    urls.add(path)
    urls.add(payload(path))
    const doc = /^\/docs\/([^/]+)$/.exec(path)
    if (doc) urls.add(`/api/docs/${doc[1]}`)
  }

  for (const { skill } of details) {
    const slug = encodeURIComponent(skill.slug)
    urls.add(`/skill/${slug}`)
    urls.add(payload(`/skill/${slug}`))
    urls.add(`/api/skills/${slug}/download`)
    for (const path of filePaths(skill.tree)) {
      const file = `/skill/${slug}/${encodePath(path)}`
      // Client-side navigation loads the page payload, not the page itself.
      urls.add(file)
      urls.add(payload(file))
      urls.add(`/api/skills/${slug}/file/${encodePath(path)}`)
    }
  }

  return [...urls]
}
