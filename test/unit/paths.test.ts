import { describe, expect, it } from 'vitest'
import { isBundleReadmePath, isSafeRelativePath } from '../../server/lib/skills/paths'

describe('isSafeRelativePath', () => {
  it.each(['README.md', 'skills/a/SKILL.md', 'hooks/pre-commit.sh', 'a b/c.md'])('accepts %s', (p) => {
    expect(isSafeRelativePath(p)).toBe(true)
  })
  it.each(['', '/etc/passwd', '../x', 'a/../b', 'a/./b', 'a//b', 'a\\b', 'a/', 'a\u0000b'])('rejects %j', (p) => {
    expect(isSafeRelativePath(p)).toBe(false)
  })
})

describe('isBundleReadmePath', () => {
  it.each(['README.md', 'readme.md', 'ReadMe.md'])('accepts %s at the bundle root', (p) => {
    expect(isBundleReadmePath(p)).toBe(true)
  })
  it.each(['docs/README.md', 'skills/demo-skill/readme.md', 'README', 'README.mdx', 'CLAUDE.md'])('rejects %s', (p) => {
    expect(isBundleReadmePath(p)).toBe(false)
  })
})
