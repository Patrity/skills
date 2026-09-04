import { describe, expect, it } from 'vitest'
import { diffOwnedFiles, emptyLockfile, ownerOf, parseLockfile, serializeLockfile, sha256 } from '../../src/lockfile'

describe('lockfile', () => {
  const lock = emptyLockfile({ registry: 'http://r', schemaVersion: 1, projectName: 'p', answers: { pm: 'pnpm' } })
  lock.bundles.demo = {
    sha: 'abc',
    files: { '.claude/rules/demo.md': sha256('rule') },
    settings: {
      shared: { hooks: { PostToolUse: ['["Edit","command","x.sh"]'] }, allow: [], deny: ['Bash(rm -rf:*)'], enabledPlugins: [] },
      local: { hooks: {}, allow: ['Bash(echo:*)'], deny: [], enabledPlugins: [] }
    }
  }
  lock.scaffolds['.claude/skills/p-browser-testing/SKILL.md'] = sha256('skill')
  lock.blocks['bundle:demo'] = sha256('- x')

  it('round-trips with stable formatting', () => {
    const text = serializeLockfile(lock)
    expect(text.endsWith('\n')).toBe(true)
    expect(parseLockfile(text)).toEqual(lock)
    expect(text.indexOf('"version"')).toBeLessThan(text.indexOf('"registry"'))
  })
  it('splits a pre-split settings record onto the file each half was merged into', () => {
    const legacy = JSON.parse(serializeLockfile(lock)) as { bundles: { demo: { settings: unknown } } }
    legacy.bundles.demo.settings = {
      hooks: { PostToolUse: ['["Edit","command","x.sh"]'] },
      allow: ['Bash(echo:*)'],
      deny: ['Bash(rm -rf:*)'],
      enabledPlugins: ['demo@registry']
    }
    const parsed = parseLockfile(JSON.stringify(legacy)).bundles.demo!.settings!
    // Hooks and deny are only ever merged into settings.json, allow only into settings.local.json.
    expect(parsed.shared).toEqual({ hooks: { PostToolUse: ['["Edit","command","x.sh"]'] }, allow: [], deny: ['Bash(rm -rf:*)'], enabledPlugins: ['demo@registry'] })
    expect(parsed.local).toEqual({ hooks: {}, allow: ['Bash(echo:*)'], deny: [], enabledPlugins: ['demo@registry'] })
  })
  it('fills in a half a hand-edited lock left out', () => {
    const partial = JSON.parse(serializeLockfile(lock)) as { bundles: { demo: { settings: unknown } } }
    partial.bundles.demo.settings = { local: { allow: ['Bash(echo:*)'] } }
    const parsed = parseLockfile(JSON.stringify(partial)).bundles.demo!.settings!
    expect(parsed.shared).toEqual({ hooks: {}, allow: [], deny: [], enabledPlugins: [] })
    expect(parsed.local.allow).toEqual(['Bash(echo:*)'])
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
