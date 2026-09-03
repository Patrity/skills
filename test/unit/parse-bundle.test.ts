import { describe, expect, it } from 'vitest'
import { buildSnapshot, parseBundle } from '../../server/lib/skills/parse-bundle'
import { MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'

const enc = (s: string) => new TextEncoder().encode(s)
const readme = `---
name: Demo
description: A demo bundle.
tags: [demo]
author: Tester
---
# Demo
`

function demoFiles() {
  return {
    'README.md': enc(readme),
    'skills/demo/SKILL.md': enc('---\nname: demo\n---\n# skill'),
    'skills/demo/cache/cached.md': enc('ignored'),
    '.DS_Store': enc('junk'),
    'hooks/pre-commit.sh': enc('#!/bin/sh\necho hi'),
    'settings.local.json': enc('{"a":1}'),
    'assets/blob.bin': new Uint8Array([1, 0, 2, 3]),
    'assets/big.txt': new Uint8Array(MAX_FILE_BYTES + 1).fill(0x61)
  }
}

describe('parseBundle', () => {
  it('produces a valid manifest and drops excluded files', () => {
    const { manifest, files } = parseBundle({ slug: 'demo', files: demoFiles() })
    expect(manifest.errors).toEqual([])
    expect(manifest.name).toBe('Demo')
    expect(manifest.tags).toEqual(['demo'])
    expect(manifest.badges).toEqual(['skills', 'hooks', 'settings'])
    expect(Object.keys(files).sort()).toEqual([
      'README.md', 'assets/big.txt', 'assets/blob.bin', 'hooks/pre-commit.sh', 'settings.local.json', 'skills/demo/SKILL.md'
    ])
    expect(manifest.fileCount).toBe(6)
    expect(manifest.totalBytes).toBe(Object.values(files).reduce((n, f) => n + f.byteLength, 0))
  })

  it('marks binary and oversized files', () => {
    const { manifest } = parseBundle({ slug: 'demo', files: demoFiles() })
    const assets = manifest.tree.find(n => n.name === 'assets')!
    expect(assets.children!.find(c => c.name === 'blob.bin')!.kind).toBe('binary')
    expect(assets.children!.find(c => c.name === 'big.txt')!.kind).toBe('oversized')
  })

  it('reports a missing README', () => {
    const { manifest } = parseBundle({ slug: 'x', files: { 'skills/a/SKILL.md': enc('hi') } })
    expect(manifest.errors).toEqual(['README.md is missing'])
    expect(manifest.name).toBe('x')
  })

  it('reports a bad slug alongside frontmatter errors', () => {
    const { manifest } = parseBundle({ slug: 'Bad_Slug', files: { 'README.md': enc('---\nname: X\n---\n') } })
    expect(manifest.errors[0]).toMatch(/^slug "Bad_Slug"/)
    expect(manifest.errors).toContain('frontmatter.description: required')
  })

  it('accepts a lowercase readme.md', () => {
    const { manifest } = parseBundle({ slug: 'demo', files: { 'readme.md': enc(readme) } })
    expect(manifest.errors).toEqual([])
  })
})

describe('buildSnapshot', () => {
  it('sorts bundles by slug and keeps files per slug', () => {
    const meta = { sha: 'abc', committedAt: '2026-09-03T00:00:00.000Z', fetchedAt: '2026-09-03T00:00:01.000Z', source: 'fs' as const }
    const snap = buildSnapshot([
      { slug: 'zeta', files: { 'README.md': enc(readme) } },
      { slug: 'alpha', files: { 'README.md': enc(readme) } }
    ], meta)
    expect(snap.sha).toBe('abc')
    expect(snap.skills.map(s => s.slug)).toEqual(['alpha', 'zeta'])
    expect(Object.keys(snap.files['alpha']!)).toEqual(['README.md'])
  })
})
