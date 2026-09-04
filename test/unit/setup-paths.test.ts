import { describe, expect, it } from 'vitest'
import { isSafeBundlePath } from '../../shared/setup/paths'

describe('isSafeBundlePath', () => {
  it('accepts normal nested paths and rejects escapes', () => {
    for (const ok of ['rules/demo.md', 'skills/a/b/SKILL.md', 'hooks/pre-commit.sh', '..foo', 'a..b/c']) expect(isSafeBundlePath(ok), ok).toBe(true)
    for (const bad of ['../evil', 'a/../b', '..', '..//x', '/etc/x', 'C:/x', 'x\\y', '']) expect(isSafeBundlePath(bad), bad).toBe(false)
  })
})
