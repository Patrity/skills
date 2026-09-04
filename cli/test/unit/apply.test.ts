import { posix, win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { inside, isUnder } from '../../src/apply'

describe('containment (posix)', () => {
  const dir = '/tmp/proj'
  it('allows a path under the project', () => {
    expect(inside(dir, '.claude/rules/x.md', posix)).toBe('/tmp/proj/.claude/rules/x.md')
    expect(isUnder(dir, '/tmp/proj/.claude', posix)).toBe(true)
  })
  it('refuses a climbing path, an absolute one, and the root itself', () => {
    expect(() => inside(dir, '../x', posix)).toThrow(/refusing to write outside the project/)
    expect(() => inside(dir, '.claude/../../x', posix)).toThrow(/refusing to write outside the project/)
    expect(() => inside(dir, '/etc/passwd', posix)).toThrow(/refusing to write outside the project/)
    expect(() => inside(dir, '.', posix)).toThrow(/refusing to write outside the project/)
    expect(isUnder(dir, '/tmp', posix)).toBe(false)
    expect(isUnder(dir, '/tmp/projector', posix)).toBe(false)
  })
})

describe('containment (win32)', () => {
  // The whole point of comparing with `relative()`: `C:\proj\.claude` never starts with `C:\proj/`,
  // so a prefix check refused every path on Windows and `init` could not write its first file.
  const dir = 'C:\\proj'
  it('allows a path under the project', () => {
    expect(inside(dir, '.claude/rules/x.md', win32)).toBe('C:\\proj\\.claude\\rules\\x.md')
    expect(isUnder(dir, 'C:\\proj\\.claude', win32)).toBe(true)
  })
  it('refuses a climbing path, another drive, and the root itself', () => {
    expect(() => inside(dir, '../x', win32)).toThrow(/refusing to write outside the project/)
    expect(() => inside(dir, 'C:\\windows\\system32\\x', win32)).toThrow(/refusing to write outside the project/)
    expect(() => inside(dir, 'D:\\x', win32)).toThrow(/refusing to write outside the project/)
    expect(() => inside(dir, '.', win32)).toThrow(/refusing to write outside the project/)
    expect(isUnder(dir, 'C:\\projector', win32)).toBe(false)
  })
})
