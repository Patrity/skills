import { describe, expect, it } from 'vitest'
import { diffOwnedFiles, emptyLockfile, ownerOf, parseLockfile, serializeLockfile, sha256 } from '../../src/lockfile'

describe('lockfile', () => {
  const lock = emptyLockfile({ registry: 'http://r', schemaVersion: 1, projectName: 'p', answers: { pm: 'pnpm' } })
  lock.bundles.demo = { sha: 'abc', files: { '.claude/rules/demo.md': sha256('rule') } }
  lock.scaffolds['.claude/skills/p-browser-testing/SKILL.md'] = sha256('skill')
  lock.blocks['bundle:demo'] = sha256('- x')

  it('round-trips with stable formatting', () => {
    const text = serializeLockfile(lock)
    expect(text.endsWith('\n')).toBe(true)
    expect(parseLockfile(text)).toEqual(lock)
    expect(text.indexOf('"version"')).toBeLessThan(text.indexOf('"registry"'))
  })
  it('rejects other versions and junk', () => {
    expect(() => parseLockfile('{"version":2}')).toThrow(/unsupported lockfile version/)
    expect(() => parseLockfile('nope')).toThrow(/not valid JSON/)
  })
  it('knows who owns a path', () => {
    expect(ownerOf(lock, '.claude/rules/demo.md')).toBe('bundle:demo')
    expect(ownerOf(lock, '.claude/skills/p-browser-testing/SKILL.md')).toBe('scaffold')
    expect(ownerOf(lock, 'CLAUDE.md')).toBeNull()
  })
  it('reports modified and missing owned files', () => {
    const r = diffOwnedFiles(lock, path => path.endsWith('demo.md') ? sha256('edited') : null)
    expect(r.modified).toEqual(['.claude/rules/demo.md'])
    expect(r.missing).toEqual(['.claude/skills/p-browser-testing/SKILL.md'])
  })
  it('hashes bytes and strings identically', () => {
    expect(sha256('abc')).toBe(sha256(new TextEncoder().encode('abc')))
    expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})
