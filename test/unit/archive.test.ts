import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { zipSync, strToU8 } from 'fflate'
import { extractArchive } from '../../server/lib/skills/archive'

const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array | undefined) => new TextDecoder().decode(b)

function fixtureZip() {
  return zipSync({
    'Patrity-skills-abc1234/package.json': enc('{}'),
    'Patrity-skills-abc1234/app/app.vue': enc('<template/>'),
    'Patrity-skills-abc1234/skills/nuxt/README.md': enc('---\nname: Nuxt\n---\n'),
    'Patrity-skills-abc1234/skills/nuxt/skills/nuxt-docs/SKILL.md': enc('# skill'),
    'Patrity-skills-abc1234/skills/nuxt/skills/nuxt-docs/cache/x.md': enc('cached'),
    'Patrity-skills-abc1234/skills/other/README.md': enc('other'),
    'Patrity-skills-abc1234/skills/.DS_Store': enc('junk')
  })
}

/**
 * Produced once from a real `git archive --format=zip --prefix=Patrity-skills-abc1234/ HEAD`
 * so the tests run against GitHub's actual zipball shape: directory entries, a bundle-relative
 * path over 100 characters (the ustar limit that broke the tarball reader) and a zero-byte file.
 */
const repoZip = readFileSync(fileURLToPath(new URL('../fixtures/repo.zip', import.meta.url)))

describe('extractBundles', () => {
  it('groups skills/<slug>/** files by slug and strips the archive prefix', () => {
    const bundles = extractArchive(fixtureZip()).bundles
    expect(bundles.map(b => b.slug).sort()).toEqual(['nuxt', 'other'])
    const nuxt = bundles.find(b => b.slug === 'nuxt')!
    expect(Object.keys(nuxt.files).sort()).toEqual(['README.md', 'skills/nuxt-docs/SKILL.md'])
    expect(dec(nuxt.files['skills/nuxt-docs/SKILL.md'])).toBe('# skill')
  })

  it('ignores files outside skills/ and excluded paths', () => {
    const bundles = extractArchive(fixtureZip()).bundles
    const all = bundles.flatMap(b => Object.keys(b.files))
    expect(all.some(p => p.includes('cache/'))).toBe(false)
    expect(bundles.some(b => b.slug === '.DS_Store')).toBe(false)
  })

  it('accepts an ArrayBuffer as well as a Uint8Array', () => {
    const bytes = fixtureZip()
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    expect(extractArchive(buf).bundles.map(b => b.slug).sort()).toEqual(['nuxt', 'other'])
  })

  it('returns [] for an archive with no skills dir', () => {
    expect(extractArchive(zipSync({ 'x-y-z/README.md': enc('root') })).bundles).toEqual([])
  })

  it('drops entries that traverse outside the bundle via a crafted path (defence in depth)', () => {
    const bundles = extractArchive(zipSync({
      'Owner-repo-sha/skills/demo/../x.md': enc('escaped'),
      'Owner-repo-sha/skills/demo/README.md': enc('ok')
    })).bundles
    const demo = bundles.find(b => b.slug === 'demo')!
    expect(Object.keys(demo.files)).toEqual(['README.md'])
  })

  it('drops entries with an empty path segment that isExcludedPath does not catch', () => {
    const bundles = extractArchive(zipSync({
      'Owner-repo-sha/skills/demo/a//b.md': enc('unsafe'),
      'Owner-repo-sha/skills/demo/README.md': enc('ok')
    })).bundles
    const demo = bundles.find(b => b.slug === 'demo')!
    expect(Object.keys(demo.files)).toEqual(['README.md'])
  })

  it('collects base/** and profiles/** as extras', async () => {
    const zip = zipSync({
      'Patrity-skills-abc1234/base/questions.yaml': strToU8('version: 1\naxes: []\n'),
      'Patrity-skills-abc1234/base/fragments/pm/pnpm.md': strToU8('## Commands\n- pnpm\n'),
      'Patrity-skills-abc1234/profiles/nuxt-app.yaml': strToU8('name: nuxt-app\n'),
      'Patrity-skills-abc1234/skills/demo/README.md': strToU8('x')
    })
    const { bundles, extras } = extractArchive(zip)
    expect(bundles.map(b => b.slug)).toEqual(['demo'])
    expect(Object.keys(extras.base).sort()).toEqual(['fragments/pm/pnpm.md', 'questions.yaml'])
    expect(Object.keys(extras.profiles)).toEqual(['nuxt-app.yaml'])
  })
})

describe('extractBundles on a real git-archive zipball', () => {
  const bundles = extractArchive(new Uint8Array(repoZip)).bundles
  const demo = bundles.find(b => b.slug === 'demo')!
  const longPath = 'skills/tool/references/a-reasonably-long-reference-document-name-for-testing-the-ustar-prefix-limit.md'

  it('finds only the demo bundle and ignores root noise and dot-slugs', () => {
    expect(bundles.map(b => b.slug)).toEqual(['demo'])
    expect(Object.keys(demo.files).some(p => p.includes('package.json'))).toBe(false)
  })

  it('keeps a bundle-relative path longer than the 100-char ustar limit, intact', () => {
    expect(longPath.length).toBeGreaterThan(100)
    expect(Object.keys(demo.files)).toContain(longPath)
    expect(dec(demo.files[longPath])).toBe('long reference body\n')
  })

  it('keeps zero-byte files as present-but-empty', () => {
    const empty = demo.files['skills/tool/__init__.py']
    expect(empty).toBeInstanceOf(Uint8Array)
    expect(empty!.byteLength).toBe(0)
  })

  it('drops directory entries, cache/ contents and dotfiles', () => {
    const paths = Object.keys(demo.files)
    expect(paths.some(p => p.endsWith('/'))).toBe(false)
    expect(paths.some(p => p.includes('cache/'))).toBe(false)
    expect(paths.some(p => p.split('/').some(seg => seg.startsWith('.')))).toBe(false)
    expect(paths.sort()).toEqual(['README.md', 'skills/tool/SKILL.md', 'skills/tool/__init__.py', longPath].sort())
  })
})
