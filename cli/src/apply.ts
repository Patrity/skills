import { chmod, mkdir, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { LOCKFILE_PATH, serializeLockfile } from './lockfile'
import type { SetupPlan } from './plan'

export interface ApplyResult {
  written: string[]
  removed: string[]
  skipped: string[]
}

/** Every path the CLI touches is resolved against the project and must sit strictly under it. */
function inside(dir: string, rel: string): string {
  const root = resolve(dir)
  const abs = resolve(root, rel)
  if (!abs.startsWith(`${root}/`)) throw new Error(`refusing to write outside the project: ${rel}`)
  return abs
}

async function write(dir: string, rel: string, data: Uint8Array | string, mode?: number): Promise<void> {
  const abs = inside(dir, rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, data)
  if (mode) await chmod(abs, mode)
}

/** Drop the directories a removal emptied (a bundle's skill folder), never the project root. */
async function pruneEmptyDirs(root: string, from: string): Promise<void> {
  let current = dirname(from)
  while (current.startsWith(`${root}/`)) {
    try {
      await rmdir(current)
    } catch {
      return // still holds something (or is already gone); nothing above it can be empty either
    }
    current = dirname(current)
  }
}

/**
 * Write a plan to disk. `create`/`update` ops are written, `conflict` ops only when the caller
 * resolved them into `overwrite`; `protected` and unresolved conflicts are reported as skipped and
 * `unchanged` ops are no-ops. The lockfile is written last, so a failure part-way never records
 * files that were not written.
 */
export async function applyPlan(plan: SetupPlan, dir: string, opts: { overwrite?: Set<string> } = {}): Promise<ApplyResult> {
  const written: string[] = []
  const skipped: string[] = []

  for (const op of plan.files) {
    const go = op.action === 'create' || op.action === 'update' || (op.action === 'conflict' && opts.overwrite?.has(op.path) === true)
    if (!go) {
      if (op.action !== 'unchanged') skipped.push(op.path)
      continue
    }
    await write(dir, op.path, op.bytes, op.mode)
    written.push(op.path)
  }

  const root = resolve(dir)
  for (const rel of plan.removals) {
    const abs = inside(root, rel)
    await rm(abs, { force: true })
    await pruneEmptyDirs(root, abs)
  }

  if (plan.claudeMd.changed) {
    await write(dir, 'CLAUDE.md', plan.claudeMd.content)
    written.push('CLAUDE.md')
  }
  if (plan.settings?.changed) {
    await write(dir, '.claude/settings.json', plan.settings.content)
    written.push('.claude/settings.json')
  }
  if (plan.settingsLocal?.changed) {
    await write(dir, '.claude/settings.local.json', plan.settingsLocal.content)
    written.push('.claude/settings.local.json')
  }
  if (plan.gitignore?.changed) {
    await write(dir, '.gitignore', plan.gitignore.content)
    written.push('.gitignore')
  }

  await write(dir, LOCKFILE_PATH, serializeLockfile(plan.lock))
  return { written, removed: plan.removals, skipped }
}
