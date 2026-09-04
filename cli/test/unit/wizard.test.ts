import { describe, expect, it } from 'vitest'
import { applyProfile, defaultAnswers, groupByTag, parseAnswerFlags, preselectedBundles, reconcileAnswers, resolveBundles, validateAnswers } from '../../src/wizard'
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
  it('reconciles recorded answers against the schema served now', () => {
    const { answers, warnings } = reconcileAnswers(schema, { pm: 'cargo', gone: 'yes', layout: 'monorepo' })
    // pm falls back to its default, the vanished axis is dropped, an axis added upstream gets its default.
    expect(answers).toEqual({ pm: 'pnpm', layout: 'monorepo', appDir: 'apps/web/app', browser: 'cli' })
    expect(warnings).toEqual([
      'lock answer pm=cargo is not an option; using default pnpm',
      'lock answer gone=yes is not an axis any more; dropped'
    ])
  })
  it('passes valid recorded answers through untouched', () => {
    const recorded = { pm: 'npm', layout: 'single', appDir: 'apps/site/app', browser: 'none' }
    expect(reconcileAnswers(schema, recorded)).toEqual({ answers: recorded, warnings: [] })
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
