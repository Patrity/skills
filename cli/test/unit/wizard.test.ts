import { describe, expect, it } from 'vitest'
import { applyProfile, defaultAnswers, groupByTag, parseAnswerFlags, preselectedBundles, resolveBundles, validateAnswers } from '../../src/wizard'
import { fixtureManifest } from '../helpers/fixtures'

const m = fixtureManifest()
const schema = m.base!

describe('wizard', () => {
  it('defaults every axis', () => {
    expect(defaultAnswers(schema)).toEqual({ pm: 'pnpm', layout: 'single', appDir: 'apps/web/app', browser: 'cli' })
  })
  it('applies a profile over defaults and parses --answer flags', () => {
    const a = applyProfile(schema, m.profiles[0], defaultAnswers(schema))
    expect(a.browser).toBe('none')
    expect(parseAnswerFlags(['pm=npm', 'appDir=x/y'])).toEqual({ pm: 'npm', appDir: 'x/y' })
    expect(() => parseAnswerFlags(['nope'])).toThrow(/expected axis=option/)
  })
  it('validates answers', () => {
    expect(validateAnswers(schema, { pm: 'bun2', zzz: 'x' })).toEqual(['pm: "bun2" is not an option', 'unknown axis "zzz"'])
    expect(validateAnswers(schema, { appDir: 'anything' })).toEqual([])
  })
  it('preselects from profile, selects and suggests', () => {
    expect(preselectedBundles(schema, { pm: 'pnpm' }, undefined, m.skills)).toEqual(['demo', 'second']) // pm=pnpm selects demo; demo suggests second
    expect(preselectedBundles(schema, { pm: 'npm' }, m.profiles[0], m.skills)).toEqual(['demo', 'second'])
  })
  it('resolves dependencies transitively and reports unknown slugs', () => {
    expect(resolveBundles(['third'], m.skills)).toEqual({ bundles: ['second', 'third'], missing: [] })
    expect(resolveBundles(['ghost', 'demo'], m.skills)).toEqual({ bundles: ['demo'], missing: ['ghost'] })
  })
  it('groups by first tag', () => {
    const g = groupByTag(m.skills)
    expect(Object.values(g).flat().length).toBe(m.skills.length)
  })
})
