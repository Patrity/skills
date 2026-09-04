import { describe, expect, it } from 'vitest'
import { ensureGitignoreLine, hookIdentity, isEmptyContribution, mergeSettings, settingsContribution, splitBundleSettings, subtractSettings } from '../../src/settings'

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
  it('replaces a hook whose command matches but whose other fields changed', () => {
    const existing = { hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ ...hook('a'), timeout: 5 }, hook('keep')] }] } }
    const incoming = { hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ ...hook('a'), timeout: 30 }] }] } }
    expect(mergeSettings(existing, incoming)).toEqual({
      hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ ...hook('a'), timeout: 30 }, hook('keep')] }] }
    })
  })
})

describe('hookIdentity', () => {
  it('is matcher + type + command, so a timeout change is the same hook', () => {
    expect(hookIdentity('Edit', { ...hook('a'), timeout: 5 })).toBe(hookIdentity('Edit', { ...hook('a'), timeout: 30 }))
    expect(hookIdentity('Edit', hook('a'))).not.toBe(hookIdentity('Write', hook('a')))
    expect(hookIdentity('Edit', hook('a'))).not.toBe(hookIdentity('Edit', hook('b')))
    expect(hookIdentity(undefined, { type: 'prompt', prompt: 'p' })).toBe(hookIdentity('', { type: 'prompt', prompt: 'p' }))
  })
})

describe('settingsContribution', () => {
  it('collects hook identities per event plus allow, deny and plugin keys', () => {
    const c = settingsContribution(
      { hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [hook('a')] }] }, permissions: { deny: ['Bash(rm:*)'] }, enabledPlugins: { p: true } },
      { permissions: { allow: ['Bash(echo:*)'] } }
    )
    expect(c.hooks).toEqual({ PostToolUse: [hookIdentity('Edit', hook('a'))] })
    expect(c).toMatchObject({ allow: ['Bash(echo:*)'], deny: ['Bash(rm:*)'], enabledPlugins: ['p'] })
    expect(isEmptyContribution(c)).toBe(false)
    expect(isEmptyContribution(settingsContribution({ outputStyle: 'Concise' }, null))).toBe(true)
  })
})

describe('subtractSettings', () => {
  const bundle = settingsContribution(
    { hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [hook('bundle')] }] }, permissions: { deny: ['Bash(rm:*)'] }, enabledPlugins: { p: true } },
    { permissions: { allow: ['Bash(echo:*)'] } }
  )

  it('takes a bundle back out and prunes what it emptied', () => {
    const existing = {
      hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ ...hook('bundle'), timeout: 30 }] }] },
      permissions: { deny: ['Bash(rm:*)'], allow: ['Bash(echo:*)'] },
      enabledPlugins: { p: true }
    }
    expect(subtractSettings(existing, bundle)).toEqual({})
  })

  it('leaves everything the user added alone', () => {
    const existing = {
      hooks: {
        PostToolUse: [{ matcher: 'Edit', hooks: [hook('bundle'), hook('mine')] }, { matcher: 'Bash', hooks: [hook('mine')] }],
        SessionStart: [{ hooks: [hook('mine')] }]
      },
      permissions: { deny: ['Bash(rm:*)', 'Bash(curl:*)'], allow: ['Bash(echo:*)'], defaultMode: 'acceptEdits' },
      enabledPlugins: { p: true, mine: true },
      outputStyle: 'Concise'
    }
    expect(subtractSettings(existing, bundle)).toEqual({
      hooks: {
        PostToolUse: [{ matcher: 'Edit', hooks: [hook('mine')] }, { matcher: 'Bash', hooks: [hook('mine')] }],
        SessionStart: [{ hooks: [hook('mine')] }]
      },
      permissions: { deny: ['Bash(curl:*)'], defaultMode: 'acceptEdits' },
      enabledPlugins: { mine: true },
      outputStyle: 'Concise'
    })
  })

  it('is a no-op on a file that never had the contribution', () => {
    expect(subtractSettings({ outputStyle: 'Concise' }, bundle)).toEqual({ outputStyle: 'Concise' })
    expect(subtractSettings(null, bundle)).toEqual({})
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
