import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { unzipSync } from 'fflate'
import type { SkillDetailResponse, SkillFileResponse, SkillsListResponse } from '../../shared/types/skills'

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
  it('returns nested code files with the detected language', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/skills/demo-skill/fetch.py')
    expect(res.language).toBe('python')
    expect(res.frontmatterRaw).toBeNull()
    expect(res.content).toContain('print(')
  })
  it('returns binary files without content', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/assets/blob.bin')
    expect(res.kind).toBe('binary')
    expect(res.content).toBeNull()
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
