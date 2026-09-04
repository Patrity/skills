import { describe, expect, it } from 'vitest'
import { GITIGNORE_END, GITIGNORE_START, gitignoreEntries, renderGitignoreBlock } from '../../shared/setup/gitignore'
import { emptyLockfile, type Lockfile } from '../../shared/setup/lock'

const block = (entries: string[]) => [GITIGNORE_START, ...entries, GITIGNORE_END].join('\n')

const lockWith = (bundles: Lockfile['bundles']): Lockfile => ({ ...emptyLockfile({ registry: 'r', schemaVersion: 1, projectName: 'p', answers: {} }), bundles })

describe('renderGitignoreBlock', () => {
  it('appends a block after one blank line to an existing file and keeps user lines', () => {
    expect(renderGitignoreBlock('node_modules\n.env', ['.claude/.env', '.claude/settings.local.json'])).toBe(`node_modules\n.env\n\n${block(['.claude/.env', '.claude/settings.local.json'])}\n`)
  })
  it('creates the file when there is none, sorted and de-duplicated', () => {
    expect(renderGitignoreBlock(null, ['b/', 'a', 'b/'])).toBe(`${block(['a', 'b/'])}\n`)
  })
  it('regenerates an existing block in place and leaves lines around it alone', () => {
    const before = `node_modules\n${block(['old'])}\n# mine\n`
    expect(renderGitignoreBlock(before, ['new'])).toBe(`node_modules\n${block(['new'])}\n# mine\n`)
  })
  it('removes the block (and the blank line it added) when there are no entries', () => {
    expect(renderGitignoreBlock(`node_modules\n\n${block(['x'])}\n`, [])).toBe('node_modules\n')
    expect(renderGitignoreBlock(null, [])).toBeNull()
    expect(renderGitignoreBlock('', [])).toBe('')
  })
  it('preserves CRLF and a missing trailing newline', () => {
    expect(renderGitignoreBlock('a\r\nb', ['x'])).toBe(`a\r\nb\r\n\r\n${block(['x']).replace(/\n/g, '\r\n')}\r\n`)
  })
  it('is idempotent', () => {
    const once = renderGitignoreBlock('a\n', ['x', 'y'])!
    expect(renderGitignoreBlock(once, ['x', 'y'])).toBe(once)
  })
})

describe('gitignoreEntries', () => {
  it('collects the settings.local line, .claude/.env and every bundle entry, sorted and unique', () => {
    const lock = lockWith({
      b: { sha: 'x', files: {}, gitignore: ['.claude/shared/'] },
      a: { sha: 'x', files: {}, gitignore: ['.claude/a/cache/', '.claude/shared/'], env: ['A_TOKEN'] }
    })
    expect(gitignoreEntries({ settingsLocal: { content: '{}', changed: true }, lock })).toEqual([
      '.claude/.env',
      '.claude/a/cache/',
      '.claude/settings.local.json',
      '.claude/shared/'
    ])
  })
  it('adds neither line when nothing asks for it', () => {
    expect(gitignoreEntries({ settingsLocal: null, lock: lockWith({ a: { sha: 'x', files: {} } }) })).toEqual([])
  })
})
