import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { runAdd, runDiff, runInit, runList, runRemove, runUpdate } from '../../src/run'
import { applyPlan } from '../../src/apply'
import { emptyLockfile, sha256 } from '../../src/lockfile'
import { ADVERTISED_REGISTRY, startRegistry } from '../helpers/registry-server'
import { startMarker } from '../../../shared/setup/markers'

/**
 * Stand-ins for the four clack prompts, so an interactive run is deterministic and a run that
 * should never prompt can be asserted on rather than hanging on stdin.
 */
const prompts = vi.hoisted(() => ({
  askAxes: vi.fn(async (_schema: unknown, answers: Record<string, string>) => answers),
  askBundles: vi.fn(async (_skills: unknown, preselected: string[]) => ({ bundles: preselected })),
  confirmPlan: vi.fn(async () => true),
  resolveConflicts: vi.fn(async () => new Set<string>())
}))
vi.mock('../../src/prompts', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/prompts')>()),
  ...prompts
}))

let registry: Awaited<ReturnType<typeof startRegistry>>
const dirs: string[] = []
/** Every run below asks for `--json`, so stdout is captured and asserted instead of printed. */
const logs: string[] = []

beforeAll(async () => {
  registry = await startRegistry()
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(a => String(a)).join(' '))
  })
})

afterAll(async () => {
  vi.restoreAllMocks()
  await registry.close()
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })))
})

beforeEach(() => {
  // Call counts only; the prompt stand-ins keep their implementations.
  vi.clearAllMocks()
})

const common = () => ({ registry: registry.url, yes: true, force: false, json: true, interactive: false })
const read = (dir: string, rel: string) => readFile(join(dir, rel), 'utf8')
const lastJson = <T>(): T => JSON.parse(logs[logs.length - 1]!) as T

async function tmpProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'skills-cli-'))
  dirs.push(dir)
  return dir
}

describe('@patrity/skills end to end', () => {
  it('init --yes --profile demo writes .claude, CLAUDE.md, settings and the lockfile', async () => {
    const dir = await tmpProject()
    const { plan } = await runInit({ ...common(), dir, profile: 'demo' })
    expect(plan.warnings).toEqual([])
    const claude = await read(dir, 'CLAUDE.md')
    expect(claude.startsWith(`# ${basename(dir)}\n`)).toBe(true)
    expect(claude).toContain('## Commands')
    expect(claude).toContain(startMarker('base:pm=pnpm'))
    expect(claude).toContain(startMarker('bundle:demo'))
    expect(claude).toContain(startMarker('bundle:second')) // suggested by demo
    expect((await stat(join(dir, '.claude/hooks/pre-commit.sh'))).mode & 0o111).toBeTruthy()
    expect(await read(dir, '.claude/rules/demo.md')).toContain('"app/**/*.vue"')
    expect(JSON.parse(await read(dir, '.claude/settings.json')).permissions.deny).toEqual(['Bash(rm -rf:*)'])
    expect(JSON.parse(await read(dir, '.claude/settings.local.json')).permissions.allow).toEqual(['Bash(echo:*)'])
    expect(await read(dir, '.gitignore')).toContain('.claude/settings.local.json')
    const lock = JSON.parse(await read(dir, '.claude/skills.lock.json'))
    expect(Object.keys(lock.bundles).sort()).toEqual(['demo', 'second'])
    expect(lock.answers).toMatchObject({ pm: 'pnpm', browser: 'none' })
    // The lockfile records where the bundles came from, not what the manifest advertised.
    expect(lock.registry).toBe(registry.url)
    expect(lock.registry).not.toBe(ADVERTISED_REGISTRY)

    // --json emits exactly one machine-readable object.
    const emitted = lastJson<{ written: string[], removed: string[], skipped: string[], warnings: string[], handEdited: string[] }>()
    expect(emitted.written).toContain('CLAUDE.md')
    expect(emitted.written).toContain('.claude/rules/demo.md')
    expect(emitted).toMatchObject({ applied: true, removed: [], skipped: [], warnings: [], handEdited: [] })
  })

  it('is idempotent and honours --answer and --with', async () => {
    const dir = await tmpProject()
    const answers = ['pm=npm', 'layout=monorepo', 'appDir=apps/site/app', 'browser=cli']
    await runInit({ ...common(), dir, answers, with: ['third'] })
    const first = await read(dir, 'CLAUDE.md')
    expect(first).toContain(startMarker('base:pm=npm'))
    expect(first).not.toContain(startMarker('base:pm=pnpm'))
    expect(first).toContain('`apps/site/app`') // the monorepo fragment renders the appDir answer
    expect(first).toContain(startMarker('bundle:third'))
    expect(first).toContain(startMarker('bundle:second')) // dependency of third
    // The answer reaches bundle files too, not just CLAUDE.md.
    expect(await read(dir, '.claude/rules/demo.md')).toContain('"apps/site/app/**/*.vue"')
    expect(await read(dir, `.claude/skills/${basename(dir)}-browser-testing/SKILL.md`)).toContain('Browser testing for')
    const lock1 = await read(dir, '.claude/skills.lock.json')

    await runInit({ ...common(), dir, answers, with: ['third'] })
    expect(await read(dir, 'CLAUDE.md')).toBe(first)
    expect(await read(dir, '.claude/skills.lock.json')).toBe(lock1)
    expect(lastJson<{ written: string[] }>().written).toEqual([])
  })

  it('add, remove, diff and list work off the lockfile', async () => {
    const dir = await tmpProject()
    await runInit({ ...common(), dir, profile: 'demo' })
    await runAdd({ ...common(), dir, slugs: ['third'] })
    expect(await read(dir, 'CLAUDE.md')).toContain(startMarker('bundle:third'))
    const list = await runList({ ...common(), dir })
    expect(list.bundles).toEqual(['demo', 'second', 'third'])
    expect(list.answers).toMatchObject({ pm: 'pnpm', browser: 'none' })

    await writeFile(join(dir, '.claude/rules/demo.md'), 'hand edited\n')
    const diff = await runDiff({ ...common(), dir })
    expect(diff.modified).toEqual(['.claude/rules/demo.md'])
    expect(diff.missing).toEqual([])
    expect(diff.handEdited).toEqual([])

    await expect(runUpdate({ ...common(), dir })).resolves.toMatchObject({
      applied: true,
      plan: { files: expect.arrayContaining([expect.objectContaining({ path: '.claude/rules/demo.md', action: 'protected' })]) }
    })
    expect(await read(dir, '.claude/rules/demo.md')).toBe('hand edited\n')
    await runUpdate({ ...common(), dir, force: true })
    expect(await read(dir, '.claude/rules/demo.md')).toContain('# Demo rule')

    // A hand-edited block whose bundle is being removed is dropped, with a warning — not resurrected.
    const edited = (await read(dir, 'CLAUDE.md')).replace('- third', '- third, and I edited this by hand')
    await writeFile(join(dir, 'CLAUDE.md'), edited)
    const { plan: removed } = await runRemove({ ...common(), dir, slugs: ['third'] })
    expect(removed.warnings).toContain('bundle:third: dropped a hand-edited block (recover it from git)')
    const afterRemove = await read(dir, 'CLAUDE.md')
    expect(afterRemove).not.toContain('bundle:third')
    expect(afterRemove).not.toContain('I edited this by hand')
    expect((await runList({ ...common(), dir })).bundles).toEqual(['demo', 'second'])
  })

  it('deletes the files of a removed bundle and the directories they emptied', async () => {
    const dir = await tmpProject()
    await runInit({ ...common(), dir, profile: 'demo' })
    const { plan } = await runRemove({ ...common(), dir, slugs: ['demo'] })
    expect(plan.removals).toEqual(['.claude/hooks/pre-commit.sh', '.claude/rules/demo.md', '.claude/skills/demo-skill/SKILL.md'])
    await expect(stat(join(dir, '.claude/rules'))).rejects.toThrow()
    await expect(stat(join(dir, '.claude/skills/demo-skill'))).rejects.toThrow()
    // The bundle that stays keeps its block, and `.claude` itself survives.
    expect(await read(dir, 'CLAUDE.md')).toContain(startMarker('bundle:second'))
    expect((await stat(join(dir, '.claude/settings.json'))).isFile()).toBe(true)
  })

  it('re-running init keeps what add installed', async () => {
    const dir = await tmpProject()
    await runInit({ ...common(), dir, profile: 'demo' })
    await runAdd({ ...common(), dir, slugs: ['third'] })
    expect((await runList({ ...common(), dir })).bundles).toEqual(['demo', 'second', 'third'])

    const { plan } = await runInit({ ...common(), dir, profile: 'demo' })
    expect(plan.removals).toEqual([])
    expect((await runList({ ...common(), dir })).bundles).toEqual(['demo', 'second', 'third'])
    expect(await read(dir, 'CLAUDE.md')).toContain(startMarker('bundle:third'))
  })

  it('re-running init keeps the answers on record; a profile and --answer still override them', async () => {
    const dir = await tmpProject()
    await runInit({ ...common(), dir, answers: ['pm=npm', 'browser=none'], with: ['demo'] })
    expect((await runList({ ...common(), dir })).answers).toMatchObject({ pm: 'npm', browser: 'none' })

    // No profile, no flags: a bare re-init edits the project, it does not reset it to the defaults.
    await runInit({ ...common(), dir })
    expect((await runList({ ...common(), dir })).answers).toMatchObject({ pm: 'npm', browser: 'none' })
    expect(await read(dir, '.claude/hooks/pre-commit.sh')).toContain('npm lint')

    await runInit({ ...common(), dir, answers: ['pm=pnpm'] })
    expect((await runList({ ...common(), dir })).answers).toMatchObject({ pm: 'pnpm', browser: 'none' })
  })

  it('reconciles a stale lockfile: unknown axes dropped, invalid answers defaulted', async () => {
    const dir = await tmpProject()
    await runInit({ ...common(), dir, profile: 'demo' })
    const lockPath = join(dir, '.claude/skills.lock.json')
    const lock = JSON.parse(await read(dir, '.claude/skills.lock.json')) as { answers: Record<string, string> }
    lock.answers = { ...lock.answers, pm: 'cargo', deploy: 'netlify' }
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)

    const { plan } = await runUpdate({ ...common(), dir })
    expect(plan.warnings).toContain('lock answer pm=cargo is not an option; using default pnpm')
    expect(plan.warnings).toContain('lock answer deploy=netlify is not an axis any more; dropped')
    // The corrected answers are what the new lockfile records — and what the files were rendered from.
    const fixed = JSON.parse(await read(dir, '.claude/skills.lock.json')) as { answers: Record<string, string> }
    expect(fixed.answers.pm).toBe('pnpm')
    expect(fixed.answers.deploy).toBeUndefined()
    expect(await read(dir, '.claude/hooks/pre-commit.sh')).toContain('pnpm lint')
  })

  it('drops a bundle that vanished upstream instead of bricking update and add', async () => {
    const dir = await tmpProject()
    await runInit({ ...common(), dir, profile: 'demo' })
    const lockPath = join(dir, '.claude/skills.lock.json')
    const lock = JSON.parse(await read(dir, '.claude/skills.lock.json')) as { bundles: Record<string, unknown> }
    lock.bundles.ghost = { sha: 'old', files: { '.claude/rules/ghost.md': sha256('ghost rule\n') } }
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
    await mkdir(join(dir, '.claude/rules'), { recursive: true })
    await writeFile(join(dir, '.claude/rules/ghost.md'), 'ghost rule\n')

    const { plan } = await runUpdate({ ...common(), dir })
    expect(plan.warnings).toContain('ghost is installed but no longer in the registry; removing its files')
    expect(plan.removals).toEqual(['.claude/rules/ghost.md'])
    await expect(stat(join(dir, '.claude/rules/ghost.md'))).rejects.toThrow()
    expect((await runList({ ...common(), dir })).bundles).toEqual(['demo', 'second'])

    // add of another slug proceeds; naming the ghost itself still fails.
    lock.bundles.ghost = { sha: 'old', files: {} }
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
    await expect(runAdd({ ...common(), dir, slugs: ['ghost'] })).rejects.toThrow(/unknown bundle: ghost/)
    const added = await runAdd({ ...common(), dir, slugs: ['third'] })
    expect(added.plan.warnings).toContain('ghost is installed but no longer in the registry; removing its files')
    expect((await runList({ ...common(), dir })).bundles).toEqual(['demo', 'second', 'third'])
  })

  it('refuses add/remove/update without a lockfile and reports unknown slugs', async () => {
    const dir = await tmpProject()
    await expect(runAdd({ ...common(), dir, slugs: ['demo'] })).rejects.toThrow(/no \.claude\/skills\.lock\.json/)
    await expect(runRemove({ ...common(), dir, slugs: ['demo'] })).rejects.toThrow(/no \.claude\/skills\.lock\.json/)
    await expect(runUpdate({ ...common(), dir })).rejects.toThrow(/no \.claude\/skills\.lock\.json/)
    await expect(runDiff({ ...common(), dir })).rejects.toThrow(/no \.claude\/skills\.lock\.json/)
    await expect(runList({ ...common(), dir })).rejects.toThrow(/no \.claude\/skills\.lock\.json/)

    await runInit({ ...common(), dir, profile: 'demo' })
    await expect(runAdd({ ...common(), dir, slugs: ['ghost'] })).rejects.toThrow(/unknown bundle: ghost/)
    await expect(runUpdate({ ...common(), dir, slugs: ['ghost'] })).rejects.toThrow(/ghost is not installed/)
    await expect(runInit({ ...common(), dir, profile: 'ghost' })).rejects.toThrow(/unknown profile: ghost/)
    await expect(runInit({ ...common(), dir, answers: ['pm=cargo'] })).rejects.toThrow(/pm: "cargo" is not an option/)
  })

  it('treats --json as non-interactive even on a TTY, and prints exactly one line', async () => {
    const dir = await tmpProject()
    const isTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    try {
      const before = logs.length
      // No `interactive` override and `yes: false`: only `json` can keep the prompts away.
      const { applied } = await runInit({ registry: registry.url, dir, yes: false, force: false, json: true, profile: 'demo' })
      expect(applied).toBe(true)
      expect(logs.length - before).toBe(1)
      expect(prompts.askAxes).not.toHaveBeenCalled()
      expect(prompts.confirmPlan).not.toHaveBeenCalled()
      expect(lastJson<{ applied: boolean }>().applied).toBe(true)
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: isTTY, configurable: true })
    }
  })

  it('writes nothing and says so when the confirmation is declined', async () => {
    const dir = await tmpProject()
    prompts.confirmPlan.mockResolvedValueOnce(false)
    const before = logs.length
    const { plan, applied } = await runInit({ registry: registry.url, dir, yes: false, force: false, json: true, interactive: true, profile: 'demo' })
    expect(applied).toBe(false)
    expect(plan.files.length).toBeGreaterThan(0)
    await expect(stat(join(dir, 'CLAUDE.md'))).rejects.toThrow()
    await expect(stat(join(dir, '.claude/skills.lock.json'))).rejects.toThrow()
    expect(logs.length - before).toBe(1)
    expect(lastJson()).toEqual({ applied: false, warnings: [] })
  })

  it('reports an unreachable registry without a stack trace', async () => {
    const dir = await tmpProject()
    await expect(runInit({ ...common(), dir, registry: 'http://127.0.0.1:1' }))
      .rejects.toThrow(/registry unreachable/)
  })

  it('refuses to write outside the project directory', async () => {
    const dir = await tmpProject()
    const lock = emptyLockfile({ registry: registry.url, schemaVersion: 1, projectName: 'p', answers: {} })
    const plan = {
      files: [{ path: '../escaped.md', bytes: new TextEncoder().encode('nope'), owner: 'bundle:evil', action: 'create' as const }],
      removals: [],
      claudeMd: { content: '', changed: false, handEdited: [] },
      settings: null,
      settingsLocal: null,
      gitignore: null,
      lock,
      warnings: []
    }
    await expect(applyPlan(plan, dir)).rejects.toThrow(/refusing to write outside the project/)
  })
})
