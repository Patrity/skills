import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { LOCKFILE_PATH, parseLockfile, type Lockfile } from './lockfile'
import type { Json } from './settings'

/** Everything `buildPlan` needs to know about the target directory, read once up front. */
export interface ProjectState {
  dir: string
  name: string
  files: (rel: string) => Promise<Uint8Array | null>
  claudeMd: string | null
  settings: Json | null
  settingsLocal: Json | null
  gitignore: string | null
  lock: Lockfile | null
}

async function readText(dir: string, rel: string): Promise<string | null> {
  try {
    return await readFile(join(dir, rel), 'utf8')
  } catch {
    return null
  }
}

async function readJson(dir: string, rel: string): Promise<Json | null> {
  const text = await readText(dir, rel)
  if (text === null) return null
  try {
    return JSON.parse(text) as Json
  } catch {
    throw new Error(`${rel} is not valid JSON`)
  }
}

export async function readProject(dir: string): Promise<ProjectState> {
  const abs = resolve(dir)
  const lockText = await readText(abs, LOCKFILE_PATH)
  const lock = lockText === null ? null : parseLockfile(lockText)
  return {
    dir: abs,
    name: lock?.projectName || basename(abs),
    files: async (rel) => {
      try {
        return new Uint8Array(await readFile(join(abs, rel)))
      } catch {
        return null
      }
    },
    claudeMd: await readText(abs, 'CLAUDE.md'),
    settings: await readJson(abs, '.claude/settings.json'),
    settingsLocal: await readJson(abs, '.claude/settings.local.json'),
    gitignore: await readText(abs, '.gitignore'),
    lock
  }
}
