import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'

const fixtures = fileURLToPath(new URL('../fixtures/skills', import.meta.url))

describe('createFsSource', () => {
  it('loads every bundle directory as a snapshot', async () => {
    const snap = await createFsSource(fixtures).load()
    expect(snap.source).toBe('fs')
    expect(snap.sha).toMatch(/^fs-[0-9a-f]{12}$/)
    expect(new Date(snap.committedAt).getTime()).toBeGreaterThan(0)
    expect(snap.skills.map(s => s.slug)).toEqual(['broken', 'demo', 'no-readme'])
  })

  it('parses the demo bundle cleanly and excludes cache files', async () => {
    const snap = await createFsSource(fixtures).load()
    const demo = snap.skills.find(s => s.slug === 'demo')!
    expect(demo.errors).toEqual([])
    expect(demo.badges).toEqual(['skills', 'rules', 'hooks', 'settings', 'claude-md'])
    expect(Object.keys(snap.files['demo']!)).not.toContain('skills/demo-skill/cache/ignored.md')
    expect(Object.keys(snap.files['demo']!)).toContain('skills/demo-skill/fetch.py')
  })

  it('surfaces invalid bundles with errors instead of throwing', async () => {
    const snap = await createFsSource(fixtures).load()
    expect(snap.skills.find(s => s.slug === 'broken')!.errors).toContain('frontmatter.tags: required')
    expect(snap.skills.find(s => s.slug === 'no-readme')!.errors).toEqual(['README.md is missing'])
  })

  it('returns an empty snapshot for a missing directory', async () => {
    const snap = await createFsSource(fixtures + '/does-not-exist').load()
    expect(snap.skills).toEqual([])
  })

  it('produces a stable sha for unchanged content', async () => {
    const a = await createFsSource(fixtures).load()
    const b = await createFsSource(fixtures).load()
    expect(a.sha).toBe(b.sha)
  })
})
