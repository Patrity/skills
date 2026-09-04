import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { runAdd, runDiff, runInit, runList, runRemove, runUpdate } from '../../src/run'
import { applyPlan } from '../../src/apply'
import { emptyLockfile } from '../../src/lockfile'
import { startRegistry } from '../helpers/registry-server'
import { startMarker } from '../../../shared/setup/markers'

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
    const plan = await runInit({ ...common(), dir, profile: 'demo' })
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
    expect(lock.registry).toBe(registry.url)

    // --json emits exactly one machine-readable object.
    const emitted = lastJson<{ written: string[], removed: string[], skipped: string[], warnings: string[], handEdited: string[] }>()
    expect(emitted.written).toContain('CLAUDE.md')
    expect(emitted.written).toContain('.claude/rules/demo.md')
    expect(emitted).toMatchObject({ removed: [], skipped: [], warnings: [], handEdited: [] })
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
      files: expect.arrayContaining([expect.objectContaining({ path: '.claude/rules/demo.md', action: 'protected' })])
    })
    expect(await read(dir, '.claude/rules/demo.md')).toBe('hand edited\n')
    await runUpdate({ ...common(), dir, force: true })
    expect(await read(dir, '.claude/rules/demo.md')).toContain('# Demo rule')

    // A hand-edited block whose bundle is being removed is dropped, with a warning — not resurrected.
    const edited = (await read(dir, 'CLAUDE.md')).replace('- third', '- third, and I edited this by hand')
    await writeFile(join(dir, 'CLAUDE.md'), edited)
    const removed = await runRemove({ ...common(), dir, slugs: ['third'] })
    expect(removed.warnings).toContain('bundle:third: dropped a hand-edited block (recover it from git)')
    const afterRemove = await read(dir, 'CLAUDE.md')
    expect(afterRemove).not.toContain('bundle:third')
    expect(afterRemove).not.toContain('I edited this by hand')
    expect((await runList({ ...common(), dir })).bundles).toEqual(['demo', 'second'])
  })

  it('deletes the files of a removed bundle and the directories they emptied', async () => {
    const dir = await tmpProject()
    await runInit({ ...common(), dir, profile: 'demo' })
    const plan = await runRemove({ ...common(), dir, slugs: ['demo'] })
    expect(plan.removals).toEqual(['.claude/hooks/pre-commit.sh', '.claude/rules/demo.md', '.claude/skills/demo-skill/SKILL.md'])
    await expect(stat(join(dir, '.claude/rules'))).rejects.toThrow()
    await expect(stat(join(dir, '.claude/skills/demo-skill'))).rejects.toThrow()
    // The bundle that stays keeps its block, and `.claude` itself survives.
    expect(await read(dir, 'CLAUDE.md')).toContain(startMarker('bundle:second'))
    expect((await stat(join(dir, '.claude/settings.json'))).isFile()).toBe(true)
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
