import { createHash } from 'node:crypto'

export const LOCKFILE_PATH = '.claude/skills.lock.json'

export interface Lockfile {
  version: 1
  registry: string
  schemaVersion: number
  projectName: string
  answers: Record<string, string>
  bundles: Record<string, { sha: string, files: Record<string, string> }>
  scaffolds: Record<string, string>
  blocks: Record<string, string>
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function emptyLockfile(init: { registry: string, schemaVersion: number, projectName: string, answers: Record<string, string> }): Lockfile {
  return {
    version: 1,
    registry: init.registry,
    schemaVersion: init.schemaVersion,
    projectName: init.projectName,
    answers: { ...init.answers },
    bundles: {},
    scaffolds: {},
    blocks: {}
  }
}

export function parseLockfile(text: string): Lockfile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`${LOCKFILE_PATH} is not valid JSON`)
  }
  if (typeof raw !== 'object' || raw === null) throw new Error(`${LOCKFILE_PATH} is malformed: expected an object`)
  const lock = raw as Partial<Lockfile>
  if (lock.version !== 1) throw new Error(`unsupported lockfile version: ${String(lock.version)}`)
  if (typeof lock.registry !== 'string') throw new Error(`${LOCKFILE_PATH} is malformed: "registry" must be a string`)
  if (typeof lock.schemaVersion !== 'number') throw new Error(`${LOCKFILE_PATH} is malformed: "schemaVersion" must be a number`)
  if (typeof lock.projectName !== 'string') throw new Error(`${LOCKFILE_PATH} is malformed: "projectName" must be a string`)
  if (typeof lock.answers !== 'object' || lock.answers === null) throw new Error(`${LOCKFILE_PATH} is malformed: "answers" must be an object`)
  if (typeof lock.bundles !== 'object' || lock.bundles === null) throw new Error(`${LOCKFILE_PATH} is malformed: "bundles" must be an object`)
  if (typeof lock.scaffolds !== 'object' || lock.scaffolds === null) throw new Error(`${LOCKFILE_PATH} is malformed: "scaffolds" must be an object`)
  if (typeof lock.blocks !== 'object' || lock.blocks === null) throw new Error(`${LOCKFILE_PATH} is malformed: "blocks" must be an object`)
  return {
    version: 1,
    registry: lock.registry,
    schemaVersion: lock.schemaVersion,
    projectName: lock.projectName,
    answers: { ...lock.answers },
    bundles: { ...lock.bundles },
    scaffolds: { ...lock.scaffolds },
    blocks: { ...lock.blocks }
  }
}

function sortedEntries<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k] as T]))
}

export function serializeLockfile(lock: Lockfile): string {
  const out = {
    version: lock.version,
    registry: lock.registry,
    schemaVersion: lock.schemaVersion,
    projectName: lock.projectName,
    answers: sortedEntries(lock.answers),
    bundles: sortedEntries(
      Object.fromEntries(
        Object.entries(lock.bundles).map(([slug, b]) => [slug, { sha: b.sha, files: sortedEntries(b.files) }])
      )
    ),
    scaffolds: sortedEntries(lock.scaffolds),
    blocks: sortedEntries(lock.blocks)
  }
  return `${JSON.stringify(out, null, 2)}\n`
}

export function ownerOf(lock: Lockfile, path: string): string | null {
  for (const [slug, bundle] of Object.entries(lock.bundles)) {
    if (path in bundle.files) return `bundle:${slug}`
  }
  if (path in lock.scaffolds) return 'scaffold'
  return null
}

export function diffOwnedFiles(lock: Lockfile, readHash: (path: string) => string | null): { modified: string[], missing: string[] } {
  const owned: Record<string, string> = { ...lock.scaffolds }
  for (const bundle of Object.values(lock.bundles)) Object.assign(owned, bundle.files)

  const modified: string[] = []
  const missing: string[] = []
  for (const path of Object.keys(owned).sort()) {
    const expected = owned[path] as string
    const actual = readHash(path)
    if (actual === null) missing.push(path)
    else if (actual !== expected) modified.push(path)
  }
  return { modified, missing }
}
