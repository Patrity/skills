import { describe, expect, it } from 'vitest'
import { GITIGNORE_END, GITIGNORE_START, GITIGNORE_UNTERMINATED, gitignoreEntries, gitignoreFileFor, hasUnterminatedBlock, renderGitignoreBlock } from '../../shared/setup/gitignore'
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
  it('returns the file untouched when it holds no block and there is nothing to add', () => {
    // Not even normalised: re-emitting it would report `changed` on a file the tool never touched.
    expect(renderGitignoreBlock('a\nb\r\nc', [])).toBe('a\nb\r\nc')
    expect(renderGitignoreBlock('node_modules', [])).toBe('node_modules')
  })
  it('leaves a file with an unterminated block alone, however often it runs', () => {
    // The end marker lost in a merge. Appending a second block would let the NEXT run read the
    // orphan as the start and the new end marker as the end, and delete mine1/mine2 with it.
    const orphan = `mine1\n${GITIGNORE_START}\nmine2\n`
    const once = renderGitignoreBlock(orphan, ['x'])!
    expect(once).toBe(orphan)
    expect(renderGitignoreBlock(once, ['x'])).toBe(orphan)
    expect(renderGitignoreBlock(orphan, [])).toBe(orphan)
  })
})

describe('hasUnterminatedBlock', () => {
  it('is true only for a start marker with no end marker after it', () => {
    expect(hasUnterminatedBlock(`mine1\n${GITIGNORE_START}\nmine2\n`)).toBe(true)
    expect(hasUnterminatedBlock(`${GITIGNORE_END}\n${GITIGNORE_START}\nx\n`)).toBe(true)
    expect(hasUnterminatedBlock(`a\n${GITIGNORE_START}\nx\n${GITIGNORE_END}\n`)).toBe(false)
    expect(hasUnterminatedBlock('node_modules\n')).toBe(false)
    expect(hasUnterminatedBlock(null)).toBe(false)
  })
})

describe('gitignoreFileFor', () => {
  it('reports the unterminated block and writes nothing', () => {
    const orphan = `mine1\n${GITIGNORE_START}\nmine2\n`
    expect(gitignoreFileFor(orphan, ['x'])).toEqual({ file: { content: orphan, changed: false }, warnings: [GITIGNORE_UNTERMINATED] })
    expect(GITIGNORE_UNTERMINATED).toBe('.gitignore has an unterminated skills block; left in place (close it with "# <<< skills")')
  })
  it('marks a fresh file changed and an untouched one unchanged, with no warnings', () => {
    expect(gitignoreFileFor(null, ['x'])).toEqual({ file: { content: `${block(['x'])}\n`, changed: true }, warnings: [] })
    expect(gitignoreFileFor('a\n', [])).toEqual({ file: { content: 'a\n', changed: false }, warnings: [] })
    expect(gitignoreFileFor(null, [])).toEqual({ file: null, warnings: [] })
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
