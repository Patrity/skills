import { describe, expect, it } from 'vitest'
import { ensureGitignoreLine, mergeSettings, splitBundleSettings } from '../../src/settings'

const hook = (command: string) => ({ type: 'command', command })

describe('mergeSettings', () => {
  it('unions hooks per event by matcher and identity', () => {
    const existing = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [hook('a')] }] } }
    const incoming = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [hook('a'), hook('b')] }, { matcher: 'Bash', hooks: [hook('c')] }], PreCompact: [{ hooks: [{ type: 'prompt', prompt: 'p' }] }] } }
    expect(mergeSettings(existing, incoming)).toEqual({
      hooks: {
        PreToolUse: [{ matcher: 'Edit|Write', hooks: [hook('a'), hook('b')] }, { matcher: 'Bash', hooks: [hook('c')] }],
        PreCompact: [{ hooks: [{ type: 'prompt', prompt: 'p' }] }]
      }
    })
  })
  it('unions deny and enabledPlugins, deep-merges other objects, incoming scalars win', () => {
    const out = mergeSettings({ permissions: { deny: ['x'] }, enabledPlugins: { a: true }, other: { k: 1, keep: true } }, { permissions: { deny: ['x', 'y'] }, enabledPlugins: { b: true }, other: { k: 2 } })
    expect(out).toEqual({ permissions: { deny: ['x', 'y'] }, enabledPlugins: { a: true, b: true }, other: { k: 2, keep: true } })
  })
  it('handles a missing existing file', () => {
    expect(mergeSettings(null, { a: 1 })).toEqual({ a: 1 })
  })
})

describe('splitBundleSettings', () => {
  it('routes permissions.allow to the local file and keeps the rest shared', () => {
    const { shared, local } = splitBundleSettings({ permissions: { allow: ['Bash(a:*)'], deny: ['Bash(rm:*)'] }, hooks: { X: [] } }, { permissions: { allow: ['Bash(b:*)'] }, outputStyle: 'Concise' })
    expect(shared).toEqual({ permissions: { deny: ['Bash(rm:*)'] }, hooks: { X: [] } })
    expect(local).toEqual({ permissions: { allow: ['Bash(a:*)', 'Bash(b:*)'] }, outputStyle: 'Concise' })
  })
  it('drops empty permissions objects', () => {
    expect(splitBundleSettings({ permissions: { allow: ['a'] } }, null)).toEqual({ shared: {}, local: { permissions: { allow: ['a'] } } })
  })
})

describe('ensureGitignoreLine', () => {
  it('appends once, preserving the file', () => {
    const once = ensureGitignoreLine('node_modules\n', '.claude/settings.local.json')
    expect(once).toBe('node_modules\n.claude/settings.local.json\n')
    expect(ensureGitignoreLine(once, '.claude/settings.local.json')).toBe(once)
    expect(ensureGitignoreLine(null, 'x')).toBe('x\n')
    expect(ensureGitignoreLine('a', 'b')).toBe('a\nb\n')
  })
})
