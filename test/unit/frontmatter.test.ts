import { describe, expect, it } from 'vitest'
import { parseFrontmatter, splitFrontmatter, SLUG_RE } from '../../server/lib/skills/frontmatter'

const good = `---
name: Nuxt
description: Nuxt 4 + Nuxt UI doc fetchers and rules.
tags: [nuxt, nuxt-ui]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
---

# Nuxt bundle
`

describe('parseFrontmatter', () => {
  it('parses a valid README', () => {
    const r = parseFrontmatter(good)
    expect(r.errors).toEqual([])
    expect(r.data).toEqual({
      name: 'Nuxt',
      description: 'Nuxt 4 + Nuxt UI doc fetchers and rules.',
      tags: ['nuxt', 'nuxt-ui'],
      author: 'Patrity',
      authorUrl: 'https://github.com/Patrity',
      requires: ['python3']
    })
  })

  it('reports each missing required key', () => {
    const r = parseFrontmatter('---\nname: X\n---\nbody')
    expect(r.data).toBeNull()
    expect(r.errors).toContain('frontmatter.description: required')
    expect(r.errors).toContain('frontmatter.tags: required')
    expect(r.errors).toContain('frontmatter.author: required')
  })

  it('reports a README with no frontmatter at all', () => {
    const r = parseFrontmatter('# just a heading')
    expect(r.data).toBeNull()
    expect(r.errors[0]).toBe('README.md has no YAML frontmatter')
  })

  it('reports an empty README instead of throwing', () => {
    const r = parseFrontmatter('')
    expect(r.data).toBeNull()
    expect(r.errors).toEqual(['README.md has no YAML frontmatter'])
  })

  it('rejects an empty tags array and a bad authorUrl', () => {
    const r = parseFrontmatter('---\nname: X\ndescription: d\ntags: []\nauthor: a\nauthorUrl: not-a-url\n---\n')
    expect(r.errors.some(e => e.startsWith('frontmatter.tags:'))).toBe(true)
    expect(r.errors.some(e => e.startsWith('frontmatter.authorUrl:'))).toBe(true)
  })
})

describe('SLUG_RE', () => {
  it.each(['nuxt', 'nuxt-ui', 'a1', '2d-rpg'])('accepts %s', s => expect(SLUG_RE.test(s)).toBe(true))
  it.each(['Nuxt', '-nuxt', 'nuxt_ui', 'nuxt ui', ''])('rejects "%s"', s => expect(SLUG_RE.test(s)).toBe(false))
})

describe('splitFrontmatter', () => {
  it('returns an empty matter string for empty input (gray-matter leaves .matter undefined)', () => {
    expect(splitFrontmatter('')).toEqual({ matter: '', data: {}, content: '' })
  })

  it('splits raw frontmatter from the body', () => {
    const r = splitFrontmatter('---\nname: X\n---\nbody\n')
    expect(r.matter.trim()).toBe('name: X')
    expect(r.data).toEqual({ name: 'X' })
    expect(r.content.trim()).toBe('body')
  })

  it('is stable across repeated identical input (gray-matter cache bug)', () => {
    const src = '---\nname: Repeat\n---\nbody\n'
    expect(splitFrontmatter(src).matter).toBe(splitFrontmatter(src).matter)
  })
})
