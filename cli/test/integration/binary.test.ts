import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startRegistry } from '../helpers/registry-server'

const BIN = join(dirname(fileURLToPath(import.meta.url)), '../../dist/index.js')
// The unit and integration suites import `src/`; only this one exercises what npm actually ships.
// CI builds before it runs the tests — locally, `pnpm --filter @patrity/skills build` once is enough.
const built = existsSync(BIN)

interface Run { code: number | null, stdout: string, stderr: string }

function run(args: string[]): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString()
    })
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString()
    })
    child.once('error', reject)
    child.once('close', code => resolve({ code, stdout, stderr }))
  })
}

let registry: Awaited<ReturnType<typeof startRegistry>>
const dirs: string[] = []

beforeAll(async () => {
  registry = await startRegistry()
})

afterAll(async () => {
  await registry.close()
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })))
})

async function tmpProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'skills-bin-'))
  dirs.push(dir)
  return dir
}

describe.skipIf(!built)('the built binary (dist/index.js)', () => {
  it('inits a project: exit 0, one JSON line on stdout, a lockfile on disk', async () => {
    const dir = await tmpProject()
    const { code, stdout, stderr } = await run(['init', '--yes', '--json', '--registry', registry.url, '--dir', dir])
    expect(stderr).toBe('')
    expect(code).toBe(0)
    const lines = stdout.trim().split('\n')
    expect(lines).toHaveLength(1)
    const emitted = JSON.parse(lines[0]!) as { applied: boolean, written: string[] }
    expect(emitted.applied).toBe(true)
    expect(emitted.written).toContain('CLAUDE.md')
    const lock = JSON.parse(await readFile(join(dir, '.claude/skills.lock.json'), 'utf8')) as { registry: string }
    expect(lock.registry).toBe(registry.url)
  })

  it('fails an unreachable registry with exit 1, no stdout and one line on stderr', async () => {
    const dir = await tmpProject()
    const { code, stdout, stderr } = await run(['init', '--yes', '--json', '--registry', 'http://127.0.0.1:1', '--dir', dir])
    expect(code).toBe(1)
    expect(stdout).toBe('')
    expect(stderr.trim().split('\n')).toHaveLength(1)
    expect(stderr).toMatch(/registry unreachable/)
    expect(existsSync(join(dir, '.claude/skills.lock.json'))).toBe(false)
  })
})

describe.skipIf(built)('the built binary', () => {
  it.skip('needs `pnpm --filter @patrity/skills build` first — dist/index.js is missing', () => {})
})
