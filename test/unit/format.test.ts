import { describe, expect, it } from 'vitest'
import { formatBytes } from '../../shared/utils/format'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1048576, '1.0 MB'],
    [5 * 1048576, '5.0 MB']
  ])('%d → %s', (n, s) => {
    expect(formatBytes(n)).toBe(s)
  })
})
