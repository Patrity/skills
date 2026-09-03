import { describe, expect, it } from 'vitest'
import { isExcludedPath, MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'
import { isBinary } from '../../server/lib/skills/sniff'

describe('isExcludedPath', () => {
  it.each([
    'skills/nuxt-docs/cache/x.md',
    'cache/anything',
    '.gitignore',
    'skills/.DS_Store',
    'skills/x/.hidden/file'
  ])('excludes %s', p => expect(isExcludedPath(p)).toBe(true))

  it.each([
    'README.md',
    'settings.local.json',
    'skills/nuxt-docs/SKILL.md',
    'hooks/pre-commit.sh',
    'skills/cache-buster/SKILL.md'
  ])('keeps %s', p => expect(isExcludedPath(p)).toBe(false))
})

describe('MAX_FILE_BYTES', () => {
  it('is 1 MB', () => expect(MAX_FILE_BYTES).toBe(1024 * 1024))
})

describe('isBinary', () => {
  it('flags a NUL byte in the first 8000 bytes', () => {
    expect(isBinary(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x0A]))).toBe(true)
  })
  it('accepts UTF-8 text', () => {
    expect(isBinary(new TextEncoder().encode('# héllo\nworld'))).toBe(false)
  })
  it('ignores a NUL past the sniff window', () => {
    const bytes = new Uint8Array(9000).fill(0x61)
    bytes[8500] = 0
    expect(isBinary(bytes)).toBe(false)
  })
})
