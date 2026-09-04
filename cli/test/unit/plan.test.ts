import { describe, expect, it } from 'vitest'
import { buildPlan, type SetupPlan } from '../../src/plan'
import { emptyLockfile, sha256 } from '../../src/lockfile'
import { mergeSettings } from '../../src/settings'
import type { ProjectState } from '../../src/project'
import { fixtureManifest, loadFixtureBundle } from '../helpers/fixtures'
import { startMarker } from '../../../shared/setup/markers'
import { GITIGNORE_END, GITIGNORE_START } from '../../../shared/setup/gitignore'

const manifest = fixtureManifest()
const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array) => new TextDecoder().decode(b)

function project(over: Partial<ProjectState> & { disk?: Record<string, string> } = {}): ProjectState {
  const disk = over.disk ?? {}
  return {
    dir: '/tmp/p',
    name: 'proj',
    claudeMd: null,
    settings: null,
    settingsLocal: null,
    // The two managed text files are read off `disk` like everything else, so a test can hand a
    // project the exact bytes a previous plan wrote.
    gitignore: disk['.gitignore'] ?? null,
    envExample: disk['.claude/.env.example'] ?? null,
    lock: null,
    files: async rel => (rel in disk ? enc(disk[rel]!) : null),
    ...over
  }
}
const answers = { pm: 'pnpm', layout: 'single', browser: 'cli' }

/** The project a previous plan leaves behind: its files on disk, its lock, its CLAUDE.md. */
function projectAfter(plan: SetupPlan): ProjectState {
  const disk: Record<string, string> = {}
  for (const f of plan.files) disk[f.path] = dec(f.bytes)
  return project({
    disk,
    lock: plan.lock,
    claudeMd: plan.claudeMd.content,
    settings: plan.settings ? JSON.parse(plan.settings.content) as Record<string, unknown> : null,
    settingsLocal: plan.settingsLocal ? JSON.parse(plan.settingsLocal.content) as Record<string, unknown> : null,
    gitignore: plan.gitignore?.content ?? null,
    envExample: plan.envExample?.content ?? null
  })
}

describe('buildPlan (fresh project)', () => {
  it('creates bundle files under .claude, renders placeholders, marks hooks executable, scaffolds, merges settings', async () => {
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
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

  it('records the registry it was handed, not the one the manifest advertises', async () => {
    const fetchedFrom = 'http://fetched-from.test'
    expect(manifest.registry).not.toBe(fetchedFrom)
    const plan = await buildPlan({ manifest, registry: fetchedFrom, project: project(), answers, bundles: [], bundleFiles: {} })
    expect(plan.lock.registry).toBe(fetchedFrom)
  })
})

describe('buildPlan (existing project)', () => {
  it('flags conflicts for foreign files, updates owned ones, and leaves unchanged ones alone', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    const first = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const ruleBytes = first.files.find(f => f.path === '.claude/rules/demo.md')!.bytes
    lock.bundles.demo = { sha: 'old', files: { '.claude/rules/demo.md': sha256(ruleBytes), '.claude/skills/demo-skill/SKILL.md': sha256('stale') } }
    const disk = {
      '.claude/rules/demo.md': new TextDecoder().decode(ruleBytes), // owned, unchanged
      '.claude/skills/demo-skill/SKILL.md': 'stale', // owned, upstream changed
      '.claude/hooks/pre-commit.sh': 'someone elses hook' // not owned → conflict
    }
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project({ disk, lock }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
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
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project({ disk, lock, claudeMd }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(plan.files.find(f => f.path === '.claude/rules/demo.md')!.action).toBe('protected')
    expect(plan.claudeMd.handEdited).toEqual(['bundle:demo'])
    expect(plan.claudeMd.content).toContain('- I edited this by hand')
    const forced = await buildPlan({ manifest, registry: manifest.registry, project: project({ disk, lock, claudeMd }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() }, force: true })
    expect(forced.files.find(f => f.path === '.claude/rules/demo.md')!.action).toBe('update')
    expect(forced.claudeMd.content).not.toContain('- I edited this by hand')
  })

  it('drops files and blocks of a bundle that is no longer selected (remove)', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'x', files: { '.claude/rules/demo.md': sha256('r') } }
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project({ disk: { '.claude/rules/demo.md': 'r' }, lock }), answers, bundles: [], bundleFiles: {} })
    expect(plan.removals).toEqual(['.claude/rules/demo.md'])
    expect(plan.lock.bundles.demo).toBeUndefined()
  })

  it('drops a hand-edited block whose source no longer contributes, with a warning', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'x', files: {} }
    lock.blocks['bundle:demo'] = sha256('- installed block')
    const claudeMd = `# proj\n\n## Commands\n\n${startMarker('bundle:demo')}\n- I edited this by hand\n<!-- /skills:bundle:demo -->\n`
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project({ lock, claudeMd }), answers, bundles: [], bundleFiles: {} })
    expect(plan.warnings).toContain('bundle:demo: dropped a hand-edited block (recover it from git)')
    expect(plan.claudeMd.handEdited).toEqual([])
    expect(plan.claudeMd.content).not.toContain('bundle:demo')
    expect(plan.claudeMd.content).not.toContain('I edited this by hand')
    expect(plan.lock.blocks['bundle:demo']).toBeUndefined()
  })
})

describe('buildPlan (re-run over its own output)', () => {
  const run = (project: ProjectState, bundleFiles = { demo: loadFixtureBundle() }) =>
    buildPlan({ manifest, registry: manifest.registry, project, answers, bundles: ['demo'], bundleFiles })

  it('is idempotent: nothing is hand-edited and CLAUDE.md does not change', async () => {
    const first = await run(project())
    // The demo snippet spans two sections, so bundle:demo owns two marker blocks.
    expect(first.claudeMd.content.split(startMarker('bundle:demo')).length - 1).toBe(2)
    const second = await run(projectAfter(first))
    expect(second.claudeMd.handEdited).toEqual([])
    expect(second.claudeMd.changed).toBe(false)
    expect(second.files.every(f => f.action === 'unchanged')).toBe(true)
    expect(second.lock.blocks).toEqual(first.lock.blocks)
    expect(second.settings!.changed).toBe(false)
    expect(second.settingsLocal!.changed).toBe(false)
    expect(second.gitignore!.changed).toBe(false)
  })

  it('takes an upstream snippet change when nothing was edited locally', async () => {
    const first = await run(project())
    const updated = loadFixtureBundle()
    updated['CLAUDE.md'] = enc('## Commands\n- `{{pm}} demo2` runs the updated demo.\n')
    const second = await run(projectAfter(first), { demo: updated })
    expect(second.claudeMd.handEdited).toEqual([])
    expect(second.claudeMd.content).toContain('`pnpm demo2` runs the updated demo.')
    expect(second.claudeMd.content).not.toContain('`pnpm demo` runs the demo.')
  })
})

describe('buildPlan (ownership and safety)', () => {
  it('skips bundle entries whose path escapes the project', async () => {
    const plan = await buildPlan({
      manifest,
      registry: manifest.registry,
      project: project(),
      answers: { pm: 'pnpm', layout: 'single', browser: 'none' },
      bundles: ['demo'],
      bundleFiles: { demo: { '../evil.md': enc('pwned'), '/etc/evil.md': enc('pwned'), 'rules/ok.md': enc('ok') } }
    })
    expect(plan.files.map(f => f.path)).toEqual(['.claude/rules/ok.md'])
    expect(plan.warnings).toEqual(['demo/../evil.md: unsafe path, skipped', 'demo//etc/evil.md: unsafe path, skipped'])
  })

  it('never claims a conflicting path in the lock', async () => {
    const disk = {
      '.claude/hooks/pre-commit.sh': 'someone elses hook',
      '.claude/skills/proj-browser-testing/SKILL.md': 'someone elses skill'
    }
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project({ disk }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(plan.files.find(f => f.path === '.claude/hooks/pre-commit.sh')!.action).toBe('conflict')
    expect(plan.files.find(f => f.path === '.claude/skills/proj-browser-testing/SKILL.md')!.action).toBe('conflict')
    expect(Object.keys(plan.lock.bundles.demo!.files)).not.toContain('.claude/hooks/pre-commit.sh')
    expect(plan.lock.scaffolds).toEqual({})
  })

  it('keeps the recorded hash of a protected marker block so it stays protected', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.blocks['bundle:demo'] = sha256('- installed block')
    const claudeMd = `# proj\n\n## Commands\n\n${startMarker('bundle:demo')}\n- I edited this by hand\n<!-- /skills:bundle:demo -->\n`
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project({ lock, claudeMd }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(plan.claudeMd.handEdited).toEqual(['bundle:demo'])
    expect(plan.lock.blocks['bundle:demo']).toBe(sha256('- installed block'))
    expect(plan.lock.blocks['bundle:demo']).not.toBe(sha256('- I edited this by hand'))
  })

  it('protects an edited scaffold but records what it writes when forced', async () => {
    const path = '.claude/skills/proj-browser-testing/SKILL.md'
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.scaffolds[path] = sha256('installed scaffold')
    const args = { manifest, registry: manifest.registry, project: project({ disk: { [path]: 'hand edited scaffold' }, lock }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } }
    const plan = await buildPlan(args)
    expect(plan.files.find(f => f.path === path)!.action).toBe('protected')
    expect(plan.lock.scaffolds[path]).toBe(sha256('installed scaffold'))
    const forced = await buildPlan({ ...args, force: true })
    const written = forced.files.find(f => f.path === path)!
    expect(written.action).toBe('update')
    expect(forced.lock.scaffolds[path]).toBe(sha256(written.bytes))
  })
})

describe('buildPlan (removals)', () => {
  it('never removes a path a still-selected bundle installs, and lists a shared one once', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'x', files: { '.claude/rules/demo.md': sha256('r') } }
    lock.bundles.other = { sha: 'x', files: { '.claude/rules/demo.md': sha256('r') } }
    const kept = await buildPlan({ manifest, registry: manifest.registry, project: project({ disk: { '.claude/rules/demo.md': 'r' }, lock }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(kept.removals).toEqual([])

    const dropped = await buildPlan({ manifest, registry: manifest.registry, project: project({ disk: { '.claude/rules/demo.md': 'r' }, lock }), answers, bundles: [], bundleFiles: {} })
    expect(dropped.removals).toEqual(['.claude/rules/demo.md'])
  })

  it('removes a file a still-selected bundle stopped shipping (upstream rename)', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'x', files: { '.claude/rules/old.md': sha256('old') } }
    const args = {
      manifest,
      registry: manifest.registry,
      answers,
      bundles: ['demo'],
      bundleFiles: { demo: loadFixtureBundle() } // ships rules/demo.md, never rules/old.md
    }
    const plan = await buildPlan({ ...args, project: project({ disk: { '.claude/rules/old.md': 'old' }, lock }) })
    expect(plan.removals).toEqual(['.claude/rules/old.md'])
    expect(plan.lock.bundles.demo!.files['.claude/rules/old.md']).toBeUndefined()
    expect(plan.lock.bundles.demo!.files['.claude/rules/demo.md']).toBeDefined()

    // Edited since install, so it is kept and reported instead of deleted behind the user's back.
    const edited = await buildPlan({ ...args, project: project({ disk: { '.claude/rules/old.md': 'mine now' }, lock }) })
    expect(edited.removals).toEqual([])
    expect(edited.warnings).toContain('.claude/rules/old.md was modified after install; left in place (remove it by hand)')
  })
})

describe('buildPlan (managed gitignore block and env example)', () => {
  it('regenerates the managed gitignore block around user lines and removes it with the last bundle', async () => {
    const first = await buildPlan({ manifest, registry: 'r', project: project({ disk: { '.gitignore': 'node_modules\n' } }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(first.gitignore!.content).toBe(`node_modules\n\n${GITIGNORE_START}\n.claude/.env\n.claude/settings.local.json\n.claude/skills/demo-skill/cache/\n${GITIGNORE_END}\n`)
    expect(first.envExample!.content).toContain('DEMO_TOKEN=<token>')
    expect(first.envExample!.changed).toBe(true)
    expect(first.lock.envExample).toBe(sha256(first.envExample!.content))
    const lock = first.lock
    const after = await buildPlan({ manifest, registry: 'r', project: project({ disk: { '.gitignore': first.gitignore!.content, '.claude/.env.example': first.envExample!.content }, lock }), answers, bundles: [], bundleFiles: {} })
    expect(after.gitignore!.content).toBe('node_modules\n')
    expect(after.envExample).toBeNull()
    expect(after.envExampleRemove).toBe(true)
    expect(after.lock.envExample).toBeUndefined()
  })

  it('leaves an edited example in place and says so instead of deleting it', async () => {
    const first = await buildPlan({ manifest, registry: 'r', project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const after = await buildPlan({ manifest, registry: 'r', project: project({ disk: { '.claude/.env.example': `${first.envExample!.content}# mine\n` }, lock: first.lock }), answers, bundles: [], bundleFiles: {} })
    expect(after.envExampleRemove).toBe(false)
    expect(after.warnings).toContain('.claude/.env.example was modified after install; left in place')
  })

  it('is idempotent over its own output', async () => {
    const first = await buildPlan({ manifest, registry: 'r', project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const second = await buildPlan({ manifest, registry: 'r', project: projectAfter(first), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(second.gitignore!.changed).toBe(false)
    expect(second.envExample!.changed).toBe(false)
    expect(second.envExampleRemove).toBe(false)
  })
})

describe('buildPlan (bundle settings)', () => {
  it('warns and keeps going when a bundle ships malformed settings', async () => {
    const files = loadFixtureBundle()
    files['settings.json'] = enc('{ bad')
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: files } })
    expect(plan.warnings).toContain('demo/settings.json: not valid JSON, skipped')
    expect(plan.settings).toBeNull()
    expect(plan.settingsLocal).toBeNull()
    // No settings.local.json to ignore; what the bundle itself declares is still in the block.
    expect(plan.gitignore!.content).not.toContain('.claude/settings.local.json')
    expect(plan.gitignore!.content).toContain('.claude/skills/demo-skill/cache/')
    expect(plan.files.some(f => f.path === '.claude/rules/demo.md')).toBe(true)
  })

  it('records what each bundle contributed to the two settings files', async () => {
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const contribution = plan.lock.bundles.demo!.settings!
    // Recorded per file: deny and hooks against settings.json, allow against settings.local.json.
    expect(contribution.shared.deny).toEqual(['Bash(rm -rf:*)'])
    expect(contribution.shared.allow).toEqual([])
    expect(Object.keys(contribution.shared.hooks)).toEqual(['PostToolUse'])
    expect(contribution.local.allow).toEqual(['Bash(echo:*)'])
    expect(contribution.local.deny).toEqual([])
    expect(contribution.local.hooks).toEqual({})
    // A bundle with nothing to merge records nothing.
    const bare = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: { 'rules/x.md': enc('x') } } })
    expect(bare.lock.bundles.demo!.settings).toBeUndefined()
  })

  it('disarms a removed bundle: its hooks and permissions leave the settings files', async () => {
    const first = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(first.settings!.content).toContain('pre-commit.sh')
    const after = projectAfter(first)
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: after, answers, bundles: [], bundleFiles: {} })
    expect(plan.settings!.changed).toBe(true)
    expect(JSON.parse(plan.settings!.content)).toEqual({})
    expect(JSON.parse(plan.settingsLocal!.content)).toEqual({})
  })

  it('never touches hooks and permissions the user added by hand', async () => {
    const first = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const after = projectAfter(first)
    const mine = { type: 'command', command: 'mine.sh' }
    after.settings = mergeSettings(after.settings, { hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [mine] }] }, permissions: { deny: ['Bash(curl:*)'] } })
    after.settingsLocal = mergeSettings(after.settingsLocal, { permissions: { allow: ['Bash(ls:*)'] } })
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: after, answers, bundles: [], bundleFiles: {} })
    const settings = JSON.parse(plan.settings!.content) as { hooks: Record<string, { hooks: unknown[] }[]>, permissions: { deny: string[] } }
    expect(settings.hooks.PostToolUse).toEqual([{ matcher: 'Edit|Write', hooks: [mine] }])
    expect(settings.permissions.deny).toEqual(['Bash(curl:*)'])
    expect(JSON.parse(plan.settingsLocal!.content)).toEqual({ permissions: { allow: ['Bash(ls:*)'] } })
  })

  it('keeps a hand-added allow in settings.json even though the bundle contributes it locally', async () => {
    const first = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    // The same permission, committed for the whole team rather than left per-machine.
    const after = projectAfter(first)
    after.settings = mergeSettings(after.settings, { permissions: { allow: ['Bash(echo:*)'] } })

    const updated = await buildPlan({ manifest, registry: manifest.registry, project: after, answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect((JSON.parse(updated.settings!.content) as { permissions: { allow?: string[] } }).permissions.allow).toEqual(['Bash(echo:*)'])
    expect(JSON.parse(updated.settingsLocal!.content)).toEqual({ permissions: { allow: ['Bash(echo:*)'] } })

    // And it outlives the bundle: settings.json never got that entry from us, so we cannot take it.
    const removed = await buildPlan({ manifest, registry: manifest.registry, project: projectAfter(updated), answers, bundles: [], bundleFiles: {} })
    expect(JSON.parse(removed.settings!.content)).toEqual({ permissions: { allow: ['Bash(echo:*)'] } })
    expect(JSON.parse(removed.settingsLocal!.content)).toEqual({})
  })

  it('keeps a hand-added deny in settings.local.json even though the bundle contributes it to settings.json', async () => {
    const first = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const after = projectAfter(first)
    after.settingsLocal = mergeSettings(after.settingsLocal, { permissions: { deny: ['Bash(rm -rf:*)'] } })

    const updated = await buildPlan({ manifest, registry: manifest.registry, project: after, answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect((JSON.parse(updated.settingsLocal!.content) as { permissions: { deny?: string[] } }).permissions.deny).toEqual(['Bash(rm -rf:*)'])
    expect((JSON.parse(updated.settings!.content) as { permissions: { deny?: string[] } }).permissions.deny).toEqual(['Bash(rm -rf:*)'])

    const removed = await buildPlan({ manifest, registry: manifest.registry, project: projectAfter(updated), answers, bundles: [], bundleFiles: {} })
    expect(JSON.parse(removed.settingsLocal!.content)).toEqual({ permissions: { deny: ['Bash(rm -rf:*)'] } })
    expect(JSON.parse(removed.settings!.content)).toEqual({})
  })

  it('replaces a hook whose timeout changed upstream instead of duplicating it', async () => {
    const files = loadFixtureBundle()
    const first = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: files } })
    const after = projectAfter(first)

    const bumped = loadFixtureBundle()
    const settings = JSON.parse(dec(bumped['settings.json']!)) as { hooks: { PostToolUse: { hooks: { timeout?: number }[] }[] } }
    settings.hooks.PostToolUse[0]!.hooks[0]!.timeout = 30
    bumped['settings.json'] = enc(JSON.stringify(settings))

    const plan = await buildPlan({ manifest, registry: manifest.registry, project: after, answers, bundles: ['demo'], bundleFiles: { demo: bumped } })
    const written = JSON.parse(plan.settings!.content) as { hooks: { PostToolUse: { hooks: { timeout?: number }[] }[] } }
    expect(written.hooks.PostToolUse).toHaveLength(1)
    expect(written.hooks.PostToolUse[0]!.hooks).toHaveLength(1)
    expect(written.hooks.PostToolUse[0]!.hooks[0]!.timeout).toBe(30)
    expect(plan.settings!.changed).toBe(true)
  })

  it('renders placeholders in settings.local.json too', async () => {
    const files = loadFixtureBundle()
    files['settings.local.json'] = enc('{ "permissions": { "allow": ["Bash({{pm}} test:*)"] } }')
    const plan = await buildPlan({ manifest, registry: manifest.registry, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: files } })
    expect(plan.settingsLocal!.content).toContain('Bash(pnpm test:*)')
    expect(plan.settingsLocal!.content).not.toContain('{{pm}}')
  })
})
