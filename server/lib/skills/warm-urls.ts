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
 * `/sitemap.xml`, `/api/skills` and `/api/skills/<slug>` are absent on purpose: the caller
 * has to fetch those to build this list, which warms them already.
 */
export function buildWarmUrls(sitemapXml: string, details: SkillDetailResponse[]): string[] {
  const urls = new Set<string>()

  const paths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => pathOf(m[1]!))
  for (const path of paths) {
    urls.add(path)
    const doc = /^\/docs\/([^/]+)$/.exec(path)
    if (doc) urls.add(`/api/docs/${doc[1]}`)
  }

  for (const { skill } of details) {
    const slug = encodeURIComponent(skill.slug)
    urls.add(`/skill/${slug}`)
    urls.add(`/skill/${slug}/_payload.json`)
    urls.add(`/api/skills/${slug}/download`)
    for (const path of filePaths(skill.tree)) {
      const file = encodePath(path)
      urls.add(`/skill/${slug}/${file}`)
      // Client-side navigation loads the page payload, not the page. Vercel ISR ignores
      // the ?_b=<buildId> Nuxt appends, so warming the bare URL fills the same entry.
      urls.add(`/skill/${slug}/${file}/_payload.json`)
      urls.add(`/api/skills/${slug}/file/${file}`)
    }
  }

  return [...urls]
}
