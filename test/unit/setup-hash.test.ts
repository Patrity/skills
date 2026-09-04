import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { sha256 } from '../../shared/setup/hash'

const node = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex')

describe('sha256 (pure)', () => {
  it('matches the known vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })
  it('agrees with node:crypto on strings, multibyte text, bytes and long inputs', () => {
    for (const s of ['x', 'héllo wörld ✓', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000)]) expect(sha256(s)).toBe(node(s))
    const bytes = new Uint8Array(70000).map((_, i) => (i * 31) & 0xff)
    expect(sha256(bytes)).toBe(node(bytes))
  })
})
