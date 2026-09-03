import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildZip } from '../../server/lib/skills/zip'
import { MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'

const enc = (s: string) => new TextEncoder().encode(s)

describe('buildZip', () => {
  it('roots every entry at <slug>/ and round-trips content', () => {
    const zip = buildZip('demo', {
      'skills/a/SKILL.md': enc('# a'),
      'README.md': enc('# readme'),
      'assets/blob.bin': new Uint8Array([1, 0, 2])
    }, new Date('2026-09-03T00:00:00Z'))
    const out = unzipSync(zip)
    expect(Object.keys(out).sort()).toEqual(['demo/README.md', 'demo/assets/blob.bin', 'demo/skills/a/SKILL.md'])
    expect(strFromU8(out['demo/README.md']!)).toBe('# readme')
    expect(Array.from(out['demo/assets/blob.bin']!)).toEqual([1, 0, 2])
  })

  it('skips oversized files', () => {
    const zip = buildZip('demo', {
      'README.md': enc('ok'),
      'big.txt': new Uint8Array(MAX_FILE_BYTES + 1)
    }, new Date())
    expect(Object.keys(unzipSync(zip))).toEqual(['demo/README.md'])
  })

  it('produces a valid archive for an empty bundle', () => {
    expect(unzipSync(buildZip('demo', {}, new Date()))).toEqual({})
  })
})
