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

  it('always warms the setup endpoints, even though nothing in the sitemap links to them', () => {
    expect(urls).toContain('/api/base')
    expect(urls).toContain('/api/profiles')
    expect(urls).toContain('/api/cli/manifest')
  })

  it('always warms the /build page and its payload, even though nothing in the sitemap links to it', () => {
    expect(urls).toContain('/build')
    expect(urls).toContain('/build/_payload.json')
  })

  it('warms the payload behind every sitemap page too, not just the bundle files', () => {
    expect(urls).toContain('/docs/getting-started/_payload.json')
    expect(urls).toContain('/docs/frontmatter/_payload.json')
    expect(urls).toContain('/docs/_payload.json')
    expect(urls).toContain('/skills/_payload.json')
    // The site root's payload sits at /_payload.json, not //_payload.json.
    expect(urls).toContain('/_payload.json')
  })
})

// The ISR cache key includes the query string, and the client always asks for
// `?_b=<buildId>`, so a bare payload URL fills an entry no browser ever requests.
describe('buildWarmUrls with a build id', () => {
  const urls = buildWarmUrls(sitemap, [detail], 'ae943e82-ec05-4981-8881-ea2cd48aac1f')

  it('stamps every payload URL with the build id and no other URL', () => {
    const payloads = urls.filter(u => u.includes('_payload.json'))
    expect(payloads.length).toBeGreaterThan(0)
    expect(payloads.every(u => u.endsWith('/_payload.json?_b=ae943e82-ec05-4981-8881-ea2cd48aac1f'))).toBe(true)
    expect(urls.filter(u => u.includes('?')).length).toBe(payloads.length)
  })

  it('keeps the path encoding it uses without a build id', () => {
    expect(urls).toContain('/skill/demo/my%20docs/a%20b.md/_payload.json?_b=ae943e82-ec05-4981-8881-ea2cd48aac1f')
    expect(urls).toContain('/_payload.json?_b=ae943e82-ec05-4981-8881-ea2cd48aac1f')
    expect(urls).toContain('/build/_payload.json?_b=ae943e82-ec05-4981-8881-ea2cd48aac1f')
  })

  it('escapes a build id that is not URL-safe', () => {
    expect(buildWarmUrls(sitemap, [], 'a b&c')).toContain('/_payload.json?_b=a%20b%26c')
  })
})
