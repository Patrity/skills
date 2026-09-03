import { describe, expect, it } from 'vitest'
import { buildWarmUrls } from '../../server/lib/skills/warm-urls'
import type { SkillDetailResponse } from '../../shared/types/skills'

// Shaped like server/routes/sitemap.xml.get.ts: absolute <loc>s on whatever origin
// NUXT_PUBLIC_SITE_URL names, which is not necessarily the host being warmed.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.test/</loc></url>
  <url><loc>https://example.test/skills</loc></url>
  <url><loc>https://example.test/docs</loc></url>
  <url><loc>https://example.test/docs/getting-started</loc></url>
  <url><loc>https://example.test/docs/frontmatter</loc></url>
  <url><loc>https://example.test/skill/demo</loc></url>
</urlset>
`

const detail = {
  skill: {
    slug: 'demo',
    tree: [
      { name: 'README.md', path: 'README.md', type: 'file' },
      {
        name: 'my docs',
        path: 'my docs',
        type: 'dir',
        children: [{ name: 'a b.md', path: 'my docs/a b.md', type: 'file' }]
      }
    ]
  }
} as unknown as SkillDetailResponse

describe('buildWarmUrls', () => {
  const urls = buildWarmUrls(sitemap, [detail])

  it('keeps the sitemap paths and drops the origin the sitemap was built with', () => {
    expect(urls).toContain('/')
    expect(urls).toContain('/skills')
    expect(urls).toContain('/docs')
    expect(urls).toContain('/docs/getting-started')
    expect(urls.every(u => u.startsWith('/'))).toBe(true)
  })

  it('adds the API route behind every docs page, and only those', () => {
    expect(urls).toContain('/api/docs/getting-started')
    expect(urls).toContain('/api/docs/frontmatter')
    expect(urls).not.toContain('/api/docs')
  })

  it('warms each bundle page, its payload and its download', () => {
    expect(urls).toContain('/skill/demo')
    expect(urls).toContain('/skill/demo/_payload.json')
    expect(urls).toContain('/api/skills/demo/download')
  })

  it('gives every file its page, its payload and its file API entry', () => {
    expect(urls).toContain('/skill/demo/README.md')
    expect(urls).toContain('/skill/demo/README.md/_payload.json')
    expect(urls).toContain('/api/skills/demo/file/README.md')
  })

  it('encodes path segments without encoding the separators', () => {
    expect(urls).toContain('/skill/demo/my%20docs/a%20b.md')
    expect(urls).toContain('/skill/demo/my%20docs/a%20b.md/_payload.json')
    expect(urls).toContain('/api/skills/demo/file/my%20docs/a%20b.md')
  })

  it('skips directories and never repeats a URL', () => {
    expect(urls).not.toContain('/skill/demo/my%20docs')
    expect(new Set(urls).size).toBe(urls.length)
  })
})
