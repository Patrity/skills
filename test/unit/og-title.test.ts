import { describe, expect, it } from 'vitest'
import { fitOgTitle } from '../../shared/utils/og'

const SHORT = 'Nuxt bundle, ready' // 18 chars
const LONG = 'The Claude Code setup I use, as bundles you can take one at a time' // 66 chars

describe('fitOgTitle', () => {
  it('leaves a title that already fits alone', () => {
    expect(SHORT.length).toBeLessThanOrEqual(42)
    expect(fitOgTitle(SHORT)).toBe(SHORT)
  })

  it('truncates a long title on a word boundary, ellipsis included in the budget', () => {
    const out = fitOgTitle(LONG)
    expect(LONG.length).toBeGreaterThan(42)
    expect(out.length).toBeLessThanOrEqual(42)
    expect(out.endsWith('…')).toBe(true)
    // The kept part is a whole-word prefix of the original.
    const kept = out.slice(0, -1)
    expect(LONG.startsWith(kept)).toBe(true)
    expect(LONG[kept.length]).toBe(' ')
  })

  it('honours a custom max', () => {
    const out = fitOgTitle(LONG, 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out).toBe('The Claude Code…')
  })

  it('never leaves a dangling space or separator before the ellipsis', () => {
    expect(fitOgTitle('Bundles for Claude Code — one at a time, no framework', 30)).toBe('Bundles for Claude Code…')
    expect(fitOgTitle('Skills, rules, hooks, settings and a CLAUDE.md', 16)).toBe('Skills, rules…')
  })

  it('collapses whitespace and trims', () => {
    expect(fitOgTitle('  Skills\n  by TechHive Labs  ')).toBe('Skills by TechHive Labs')
  })

  it('falls back to a hard cut when the first word is longer than the budget', () => {
    const out = fitOgTitle('Supercalifragilisticexpialidocious', 12)
    expect(out).toBe('Supercalifr…')
    expect(out.length).toBe(12)
  })

  it('survives an empty title', () => {
    expect(fitOgTitle('')).toBe('')
    expect(fitOgTitle('   ')).toBe('')
  })
})
