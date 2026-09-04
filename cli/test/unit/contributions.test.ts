import { describe, expect, it } from 'vitest'
import { activeAxes, contributionsFor, scaffoldsFor } from '../../src/contributions'
import { fixtureManifest, loadFixtureBundle } from '../helpers/fixtures'
import { placeholderVars } from '../../../shared/setup/placeholders'

const manifest = fixtureManifest()

describe('activeAxes', () => {
  it('skips follow-ups whose condition is not met', () => {
    expect(activeAxes(manifest.base!, { layout: 'single' }).map(a => a.id)).toEqual(['pm', 'layout', 'browser'])
    expect(activeAxes(manifest.base!, { layout: 'monorepo' }).map(a => a.id)).toEqual(['pm', 'layout', 'appDir', 'browser'])
  })
})

describe('contributionsFor', () => {
  it('orders always → axes → bundles, sections split, placeholders rendered', () => {
    const answers = { pm: 'pnpm', layout: 'monorepo', appDir: 'apps/web/app', browser: 'none' }
    const { contributions, warnings } = contributionsFor({
      manifest,
      answers,
      bundles: ['demo'],
      bundleFiles: { demo: loadFixtureBundle() },
      vars: { ...placeholderVars(answers, 'proj'), appDir: 'apps/web/app' }
    })
    expect(warnings).toEqual([])
    expect(contributions.map(c => [c.sourceId, c.sectionId])).toEqual([
      ['base:always/self-improvement', 'self-improvement'],
      ['base:pm=pnpm', 'commands'],
      ['base:layout=monorepo', 'constraints'],
      ['bundle:demo', 'commands'],
      ['bundle:demo', 'skills-and-rules']
    ])
    expect(contributions[1]!.markdown).toContain('Always `pnpm`')
    expect(contributions[2]!.markdown).toContain('`apps/web/app`')
    expect(contributions[3]!.markdown).toBe('- `pnpm demo` runs the demo.')
  })

  it('warns on unknown placeholders and skips bundles without a snippet', () => {
    const files = loadFixtureBundle()
    files['CLAUDE.md'] = new TextEncoder().encode('## Commands\n- {{mystery}}\n')
    const { contributions, warnings } = contributionsFor({
      manifest,
      answers: { pm: 'npm', layout: 'single', browser: 'none' },
      bundles: ['demo', 'second'],
      bundleFiles: { demo: files, second: {} },
      vars: placeholderVars({ pm: 'npm' }, 'p')
    })
    expect(warnings).toEqual(['bundle:demo CLAUDE.md: unknown placeholder {{mystery}}'])
    expect(contributions.some(c => c.sourceId === 'bundle:second')).toBe(false)
  })
})

describe('scaffoldsFor', () => {
  it('lists scaffolds for chosen options only', () => {
    expect(scaffoldsFor(manifest.base!, { browser: 'cli' })).toEqual([{ template: 'browser-testing-project.md', to: '.claude/skills/{{projectName}}-browser-testing/SKILL.md', mode: 'create' }])
    expect(scaffoldsFor(manifest.base!, { browser: 'none' })).toEqual([])
  })
})
