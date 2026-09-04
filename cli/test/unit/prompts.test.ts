import { describe, expect, it } from 'vitest'
import { summarize } from '../../src/prompts'
import { emptyLockfile } from '../../src/lockfile'
import type { FileOp, SetupPlan } from '../../src/plan'

const op = (path: string, action: FileOp['action']): FileOp => ({ path, bytes: new Uint8Array(), owner: 'bundle:demo', action })

const plan = (files: FileOp[], over: Partial<SetupPlan> = {}): SetupPlan => ({
  files,
  removals: [],
  claudeMd: { content: '', changed: false, handEdited: [] },
  settings: null,
  settingsLocal: null,
  gitignore: null,
  lock: emptyLockfile({ registry: 'http://registry.test', schemaVersion: 1, projectName: 'p', answers: {} }),
  warnings: [],
  ...over
})

describe('summarize', () => {
  it('names every path it will not write, not just how many there are', () => {
    const out = summarize(plan([
      op('.claude/rules/demo.md', 'create'),
      op('.claude/hooks/pre-commit.sh', 'conflict'),
      op('.claude/settings-note.md', 'conflict'),
      op('.claude/skills/demo-skill/SKILL.md', 'protected')
    ]))
    expect(out).toContain('conflicts 2')
    expect(out).toContain('conflict: .claude/hooks/pre-commit.sh (kept yours)')
    expect(out).toContain('conflict: .claude/settings-note.md (kept yours)')
    expect(out).toContain('protected: .claude/skills/demo-skill/SKILL.md (kept your edit)')
  })

  it('says which conflicts the interactive answers resolved into an overwrite', () => {
    const out = summarize(plan([op('a.md', 'conflict'), op('b.md', 'conflict')]), new Set(['a.md']))
    expect(out).toContain('conflict: a.md (overwriting)')
    expect(out).toContain('conflict: b.md (kept yours)')
  })

  it('keeps the counts, removals and warnings it always had', () => {
    const out = summarize(plan([op('a.md', 'create')], { removals: ['.claude/rules/old.md'], warnings: ['ghost is gone'] }))
    expect(out.split('\n')[0]).toBe('create 1 · update 0 · unchanged 0 · conflicts 0 · protected 0')
    expect(out).toContain('remove 1: .claude/rules/old.md')
    expect(out).toContain('⚠ ghost is gone')
  })
})
