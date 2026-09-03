import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { unzipSync } from 'fflate'
import type { SkillDetailResponse, SkillFileResponse, SkillsListResponse } from '../../shared/types/skills'
import type { DocResponse } from '../../shared/types/docs'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  setupTimeout: 240_000,
  nuxtConfig: {
    runtimeConfig: {
      skillsSource: 'fs',
      skillsDir: fileURLToPath(new URL('../fixtures/skills', import.meta.url)),
      revalidateSecret: 'test-secret'
    }
  }
})

describe('GET /api/skills', () => {
  it('tags the response for tag-based cache purges', async () => {
    const res = await fetch('/api/skills')
    expect(res.headers.get('vercel-cache-tag')).toBe('skills')
  })

  it('lists bundles from the fixture dir, including invalid ones in fs mode', async () => {
    const res = await $fetch<SkillsListResponse>('/api/skills')
    expect(res.source).toBe('fs')
    expect(res.sha).toMatch(/^fs-/)
    expect(res.skills.map(s => s.slug)).toEqual(['broken', 'demo', 'no-readme'])
    expect(res.skills.find(s => s.slug === 'demo')).toMatchObject({ name: 'Demo', tags: ['demo', 'fixture'], errors: [] })
    expect('tree' in res.skills[0]!).toBe(false)
  })
})

describe('GET /api/skills/:slug', () => {
  it('returns the manifest with its tree', async () => {
    const res = await $fetch<SkillDetailResponse>('/api/skills/demo')
    expect(res.skill.badges).toEqual(['skills', 'rules', 'hooks', 'settings', 'claude-md'])
    expect(res.skill.tree.some(n => n.name === 'README.md')).toBe(true)
  })
  it('404s for an unknown slug', async () => {
    const res = await fetch('/api/skills/does-not-exist')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/skills/:slug/file/*', () => {
  it('returns markdown with its raw frontmatter split out', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/README.md')
    expect(res).toMatchObject({ path: 'README.md', language: 'markdown', kind: 'text' })
    expect(res.frontmatterRaw).toContain('name: Demo')
    expect(res.content).toContain('# Demo bundle')
  })
  it('ships a server-parsed MDC AST plus its frontmatter so the browser never parses or highlights', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/README.md')
    expect(res.body?.type).toBe('root')
    expect(res.body!.children.length).toBeGreaterThan(0)
    expect(res.data).toMatchObject({ name: 'Demo' })
  })
  it('returns nested code files with the detected language', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/skills/demo-skill/fetch.py')
    expect(res.language).toBe('python')
    expect(res.frontmatterRaw).toBeNull()
    expect(res.content).toContain('print(')
    expect(res.body).toBeNull()
    expect(res.data).toBeNull()
  })
  it('returns binary files without content', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/assets/blob.bin')
    expect(res.kind).toBe('binary')
    expect(res.content).toBeNull()
  })
  it('serves an empty markdown file as an empty string, not a 500', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/rules/empty.md')
    expect(res).toMatchObject({ path: 'rules/empty.md', language: 'markdown', kind: 'text', size: 0 })
    expect(res.content).toBe('')
    expect(res.frontmatterRaw).toBeNull()
  })
  it('404s for directories, excluded files and unknown paths', async () => {
    expect((await fetch('/api/skills/demo/file/skills')).status).toBe(404)
    expect((await fetch('/api/skills/demo/file/skills/demo-skill/cache/ignored.md')).status).toBe(404)
    expect((await fetch('/api/skills/demo/file/nope.md')).status).toBe(404)
  })
  it('rejects traversal attempts', async () => {
    const res = await fetch('/api/skills/demo/file/..%2F..%2Fpackage.json')
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('GET /api/skills/:slug/download', () => {
  it('streams a zip rooted at <slug>/ without excluded files', async () => {
    const res = await fetch('/api/skills/demo/download')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="demo.zip"')
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const names = Object.keys(files)
    expect(names).toContain('demo/README.md')
    expect(names).toContain('demo/skills/demo-skill/fetch.py')
    expect(names.every(n => n.startsWith('demo/'))).toBe(true)
    expect(names.some(n => n.includes('/cache/'))).toBe(false)
  })
})

describe('GET /api/docs/:slug', () => {
  it('reads the doc out of the server asset bundle and renders it', async () => {
    const res = await $fetch<DocResponse>('/api/docs/getting-started')
    expect(res.entry).toMatchObject({ slug: 'getting-started', title: 'Getting started' })
    expect(res.body.type).toBe('root')
    expect(res.body.children.length).toBeGreaterThan(0)
    expect(res.data).toEqual({})
  })
  it('404s for a slug that is not in the nav', async () => {
    expect((await fetch('/api/docs/nope')).status).toBe(404)
  })
})

describe('POST /api/revalidate', () => {
  it('401s without the bearer secret', async () => {
    expect((await fetch('/api/revalidate', { method: 'POST' })).status).toBe(401)
    expect((await fetch('/api/revalidate', { method: 'POST', headers: { authorization: 'Bearer wrong' } })).status).toBe(401)
  })
  it('refreshes and returns the sha with the right secret', async () => {
    const res = await $fetch<{ ok: boolean, sha: string }>('/api/revalidate', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' }
    })
    expect(res.ok).toBe(true)
    expect(res.sha).toMatch(/^fs-/)
  })
})

describe('meta routes', () => {
  it('health reports the snapshot', async () => {
    const res = await $fetch<{ ok: boolean, source: string }>('/api/health')
    expect(res).toMatchObject({ ok: true, source: 'fs' })
  })
  it('robots.txt points at the sitemap', async () => {
    const txt = await $fetch<string>('/robots.txt')
    expect(txt).toContain('Sitemap: ')
  })
  it('sitemap lists public skill pages', async () => {
    const xml = await $fetch<string>('/sitemap.xml')
    expect(xml).toContain('<loc>http://localhost:3000/skill/demo</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/skills</loc>')
  })
})

describe('docs pages', () => {
  it('renders a known doc', async () => {
    expect((await fetch('/docs/frontmatter')).status).toBe(200)
  })
  it('404s for an unknown doc', async () => {
    expect((await fetch('/docs/nope')).status).toBe(404)
  })
})

describe('skill pages', () => {
  it('404s for an unknown bundle', async () => {
    expect((await fetch('/skill/nope')).status).toBe(404)
  })
  it('404s for an unknown file inside a known bundle', async () => {
    expect((await fetch('/skill/demo/nope.md')).status).toBe(404)
  })
  it('renders a known bundle', async () => {
    expect((await fetch('/skill/demo')).status).toBe(200)
  })
})
