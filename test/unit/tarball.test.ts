import { describe, expect, it } from 'vitest'
import { createTarGzip } from 'nanotar'
import { extractBundles } from '../../server/lib/skills/tarball'

async function fixtureTgz() {
  return createTarGzip([
    { name: 'Patrity-skills-abc1234/package.json', data: '{}' },
    { name: 'Patrity-skills-abc1234/app/app.vue', data: '<template/>' },
    { name: 'Patrity-skills-abc1234/skills/nuxt/README.md', data: '---\nname: Nuxt\n---\n' },
    { name: 'Patrity-skills-abc1234/skills/nuxt/skills/nuxt-docs/SKILL.md', data: '# skill' },
    { name: 'Patrity-skills-abc1234/skills/nuxt/skills/nuxt-docs/cache/x.md', data: 'cached' },
    { name: 'Patrity-skills-abc1234/skills/other/README.md', data: 'other' },
    { name: 'Patrity-skills-abc1234/skills/.DS_Store', data: 'junk' }
  ])
}

describe('extractBundles', () => {
  it('groups skills/<slug>/** files by slug and strips the archive prefix', async () => {
    const bundles = await extractBundles(await fixtureTgz())
    expect(bundles.map(b => b.slug).sort()).toEqual(['nuxt', 'other'])
    const nuxt = bundles.find(b => b.slug === 'nuxt')!
    expect(Object.keys(nuxt.files).sort()).toEqual(['README.md', 'skills/nuxt-docs/SKILL.md'])
    expect(new TextDecoder().decode(nuxt.files['skills/nuxt-docs/SKILL.md'])).toBe('# skill')
  })

  it('ignores files outside skills/ and excluded paths', async () => {
    const bundles = await extractBundles(await fixtureTgz())
    const all = bundles.flatMap(b => Object.keys(b.files))
    expect(all.some(p => p.includes('cache/'))).toBe(false)
    expect(bundles.some(b => b.slug === '.DS_Store')).toBe(false)
  })

  it('returns [] for a tarball with no skills dir', async () => {
    const tgz = await createTarGzip([{ name: 'x-y-z/README.md', data: 'root' }])
    expect(await extractBundles(tgz)).toEqual([])
  })
})
