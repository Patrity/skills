import { describe, expect, it } from 'vitest'
import { buildPlan } from '../../src/plan'
import { emptyLockfile, sha256 } from '../../src/lockfile'
import type { ProjectState } from '../../src/project'
import { fixtureManifest, loadFixtureBundle } from '../helpers/fixtures'
import { startMarker } from '../../../shared/setup/markers'

const manifest = fixtureManifest()
const enc = (s: string) => new TextEncoder().encode(s)

function project(over: Partial<ProjectState> & { disk?: Record<string, string> } = {}): ProjectState {
  const disk = over.disk ?? {}
  return {
    dir: '/tmp/p',
    name: 'proj',
    claudeMd: null,
    settings: null,
    settingsLocal: null,
    gitignore: null,
    lock: null,
    files: async rel => (rel in disk ? enc(disk[rel]!) : null),
    ...over
  }
}
const answers = { pm: 'pnpm', layout: 'single', browser: 'cli' }

describe('buildPlan (fresh project)', () => {
  it('creates bundle files under .claude, renders placeholders, marks hooks executable, scaffolds, merges settings', async () => {
    const plan = await buildPlan({ manifest, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const paths = plan.files.map(f => f.path).sort()
    expect(paths).toEqual(['.claude/hooks/pre-commit.sh', '.claude/rules/demo.md', '.claude/skills/demo-skill/SKILL.md', '.claude/skills/proj-browser-testing/SKILL.md'])
    expect(plan.files.every(f => f.action === 'create')).toBe(true)
    const hook = plan.files.find(f => f.path.endsWith('pre-commit.sh'))!
    expect(hook.mode).toBe(0o755)
    expect(new TextDecoder().decode(hook.bytes)).toContain('pnpm lint')
    expect(new TextDecoder().decode(plan.files.find(f => f.path.endsWith('rules/demo.md'))!.bytes)).toContain('"app/**/*.vue"')
    expect(new TextDecoder().decode(plan.files.find(f => f.path.includes('proj-browser-testing'))!.bytes)).toContain('Browser testing for proj')
    expect(plan.settings!.content).toContain('"deny"')
    expect(plan.settings!.content).not.toContain('"allow"')
    expect(plan.settingsLocal!.content).toContain('Bash(echo:*)')
    expect(plan.gitignore!.content).toContain('.claude/settings.local.json')
    expect(plan.claudeMd.content.startsWith('# proj\n')).toBe(true)
    expect(plan.claudeMd.content).toContain(startMarker('bundle:demo'))
    expect(plan.lock.bundles.demo!.files['.claude/rules/demo.md']).toBe(sha256(plan.files.find(f => f.path.endsWith('rules/demo.md'))!.bytes))
    expect(plan.lock.blocks['bundle:demo']).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('buildPlan (existing project)', () => {
  it('flags conflicts for foreign files, updates owned ones, and leaves unchanged ones alone', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    const first = await buildPlan({ manifest, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const ruleBytes = first.files.find(f => f.path === '.claude/rules/demo.md')!.bytes
    lock.bundles.demo = { sha: 'old', files: { '.claude/rules/demo.md': sha256(ruleBytes), '.claude/skills/demo-skill/SKILL.md': sha256('stale') } }
    const disk = {
      '.claude/rules/demo.md': new TextDecoder().decode(ruleBytes), // owned, unchanged
      '.claude/skills/demo-skill/SKILL.md': 'stale', // owned, upstream changed
      '.claude/hooks/pre-commit.sh': 'someone elses hook' // not owned → conflict
    }
    const plan = await buildPlan({ manifest, project: project({ disk, lock }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const byPath = Object.fromEntries(plan.files.map(f => [f.path, f.action]))
    expect(byPath['.claude/rules/demo.md']).toBe('unchanged')
    expect(byPath['.claude/skills/demo-skill/SKILL.md']).toBe('update')
    expect(byPath['.claude/hooks/pre-commit.sh']).toBe('conflict')
  })

  it('protects hand-edited owned files and marker blocks unless forced', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'old', files: { '.claude/rules/demo.md': sha256('installed') } }
    lock.blocks['bundle:demo'] = sha256('- installed block')
    const claudeMd = `# proj\n\n## Commands\n\n${startMarker('bundle:demo')}\n- I edited this by hand\n<!-- /skills:bundle:demo -->\n`
    const disk = { '.claude/rules/demo.md': 'edited by hand' }
    const plan = await buildPlan({ manifest, project: project({ disk, lock, claudeMd }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(plan.files.find(f => f.path === '.claude/rules/demo.md')!.action).toBe('protected')
    expect(plan.claudeMd.handEdited).toEqual(['bundle:demo'])
    expect(plan.claudeMd.content).toContain('- I edited this by hand')
    const forced = await buildPlan({ manifest, project: project({ disk, lock, claudeMd }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() }, force: true })
    expect(forced.files.find(f => f.path === '.claude/rules/demo.md')!.action).toBe('update')
    expect(forced.claudeMd.content).not.toContain('- I edited this by hand')
  })

  it('drops files and blocks of a bundle that is no longer selected (remove)', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'x', files: { '.claude/rules/demo.md': sha256('r') } }
    const plan = await buildPlan({ manifest, project: project({ disk: { '.claude/rules/demo.md': 'r' }, lock }), answers, bundles: [], bundleFiles: {} })
    expect(plan.removals).toEqual(['.claude/rules/demo.md'])
    expect(plan.lock.bundles.demo).toBeUndefined()
  })
})
