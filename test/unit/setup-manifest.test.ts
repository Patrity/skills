import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'
import { toCliManifest } from '../../server/lib/setup/manifest'

const dir = fileURLToPath(new URL('../fixtures/skills', import.meta.url))

describe('toCliManifest', () => {
  it('projects a manifest record into the CLI manifest shape', async () => {
    const snap = await createFsSource(dir).load()
    const m = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'https://example.test/')
    expect(m.registry).toBe('https://example.test')
    expect(m.sha).toBe(snap.sha)
    expect(m.skills.map(s => s.slug)).toContain('demo')
    expect('tree' in m.skills[0]!).toBe(false)
    expect(m.base?.axes.map(a => a.id)).toEqual(['pm', 'layout', 'appDir'])
    expect(m.errors).toEqual([])
  })
})
