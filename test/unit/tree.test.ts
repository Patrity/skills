import { describe, expect, it } from 'vitest'
import { buildTree, deriveBadges, findFile } from '../../server/lib/skills/tree'

const entries = {
  'README.md': { size: 10, kind: 'text' as const },
  'skills/nuxt-docs/SKILL.md': { size: 20, kind: 'text' as const },
  'skills/nuxt-docs/fetch.py': { size: 30, kind: 'text' as const },
  'rules/web-nuxt.md': { size: 5, kind: 'text' as const },
  'CLAUDE.md': { size: 7, kind: 'text' as const }
}

describe('buildTree', () => {
  it('nests by directory, dirs first then alphabetical', () => {
    const tree = buildTree(entries)
    expect(tree.map(n => `${n.type}:${n.name}`)).toEqual([
      'dir:rules', 'dir:skills', 'file:CLAUDE.md', 'file:README.md'
    ])
    const skills = tree.find(n => n.name === 'skills')!
    expect(skills.path).toBe('skills')
    const nuxtDocs = skills.children![0]!
    expect(nuxtDocs.path).toBe('skills/nuxt-docs')
    expect(nuxtDocs.children!.map(c => c.name)).toEqual(['fetch.py', 'SKILL.md'])
    expect(nuxtDocs.children![1]).toMatchObject({ type: 'file', size: 20, kind: 'text', path: 'skills/nuxt-docs/SKILL.md' })
  })
})

describe('findFile', () => {
  const tree = buildTree(entries)
  it('finds a nested file by path', () => {
    expect(findFile(tree, 'skills/nuxt-docs/fetch.py')?.size).toBe(30)
  })
  it('returns null for directories and unknown paths', () => {
    expect(findFile(tree, 'skills')).toBeNull()
    expect(findFile(tree, 'nope.md')).toBeNull()
  })
})

describe('deriveBadges', () => {
  it('derives badges in canonical order', () => {
    expect(deriveBadges(['CLAUDE.md', 'settings.local.json', 'hooks/a.sh', 'rules/r.md', 'skills/s/SKILL.md', 'README.md']))
      .toEqual(['skills', 'rules', 'hooks', 'settings', 'claude-md'])
  })
  it('is case-insensitive for CLAUDE.md only', () => {
    expect(deriveBadges(['claude.md'])).toEqual(['claude-md'])
    expect(deriveBadges(['Settings.local.json'])).toEqual([])
  })
})
