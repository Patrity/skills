import type { SettingsContribution } from './settings'

/** Only ever quoted in the parse errors below; the CLI owns the real constant. */
const LOCKFILE_PATH = '.claude/skills.lock.json'

/**
 * What one bundle merged into each settings file, kept apart so a later run subtracts each half
 * only from the file it landed in — an identical entry the user keeps in the other file survives.
 */
export interface LockSettings {
  /** Merged into `.claude/settings.json`: hooks, `permissions.deny`, plugins from settings.json. */
  shared: SettingsContribution
  /** Merged into `.claude/settings.local.json`: `permissions.allow` and anything from settings.local.json. */
  local: SettingsContribution
}

export interface LockBundle {
  sha: string
  files: Record<string, string>
  /** Paths this bundle contributed to the managed block in `.gitignore`. */
  gitignore?: string[]
  /** Names of the variables this bundle declared, so `.claude/.env.example` can be rebuilt. */
  env?: string[]
  /** What this bundle merged into settings.json / settings.local.json, so removing it can undo it. */
  settings?: LockSettings
}

export interface Lockfile {
  version: 1
  registry: string
  schemaVersion: number
  projectName: string
  answers: Record<string, string>
  bundles: Record<string, LockBundle>
  scaffolds: Record<string, string>
  blocks: Record<string, string>
  /** sha256 of the last `.claude/.env.example` the tool wrote; absent when it wrote none. */
  envExample?: string
}

export { sha256 } from './hash'

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
    bundles: Object.fromEntries(Object.entries(lock.bundles).map(([slug, b]) => [slug, parseBundle(b)])),
    scaffolds: { ...lock.scaffolds },
    blocks: { ...lock.blocks },
    ...(typeof lock.envExample === 'string' ? { envExample: lock.envExample } : {})
  }
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parseContribution(raw: unknown): SettingsContribution {
  const { hooks, allow, deny, enabledPlugins } = (isRecord(raw) ? raw : {}) as { hooks?: unknown, allow?: unknown, deny?: unknown, enabledPlugins?: unknown }
  const events: Record<string, string[]> = {}
  if (isRecord(hooks)) for (const [event, ids] of Object.entries(hooks)) events[event] = strings(ids)
  return { hooks: events, allow: strings(allow), deny: strings(deny), enabledPlugins: strings(enabledPlugins) }
}

/**
 * A lock written before the contribution was split per file recorded one file-agnostic record. The
 * split is deterministic for three of its four keys — `permissions.allow` is only ever merged into
 * settings.local.json, hooks and `permissions.deny` only into settings.json — so those are put back
 * on the half they came from. Only `enabledPlugins` is ambiguous (either file may carry it); it
 * stays on both halves, as before, so a removed bundle's plugin is never left enabled. The lock is
 * rewritten in the new shape on the first run, so this reading happens at most once.
 */
function migrateContribution(c: SettingsContribution): LockSettings {
  return {
    shared: { hooks: c.hooks, allow: [], deny: c.deny, enabledPlugins: c.enabledPlugins },
    local: { hooks: {}, allow: c.allow, deny: [], enabledPlugins: c.enabledPlugins }
  }
}

/** A lockfile written before `settings` existed simply has none: it parses, and nothing is undone. */
function parseBundle(bundle: LockBundle): LockBundle {
  const raw = bundle as LockBundle & { settings?: unknown, gitignore?: unknown, env?: unknown }
  const out: LockBundle = { sha: bundle.sha, files: { ...bundle.files } }
  // Written since the managed .gitignore block and .claude/.env.example landed; an older lock has
  // neither, and simply contributes nothing to either file until the next run re-records it.
  const gitignore = strings(raw.gitignore)
  if (gitignore.length) out.gitignore = gitignore
  const env = strings(raw.env)
  if (env.length) out.env = env
  const s: unknown = raw.settings
  if (!isRecord(s)) return out
  out.settings = 'shared' in s || 'local' in s
    ? { shared: parseContribution(s.shared), local: parseContribution(s.local) }
    : migrateContribution(parseContribution(s))
  return out
}

function sortedEntries<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k] as T]))
}

/** Sorted throughout, like every other lockfile field: the file must be byte-identical run to run. */
function serializeContribution(c: SettingsContribution): SettingsContribution {
  return {
    hooks: sortedEntries(Object.fromEntries(Object.entries(c.hooks).map(([event, ids]) => [event, [...ids].sort()]))),
    allow: [...c.allow].sort(),
    deny: [...c.deny].sort(),
    enabledPlugins: [...c.enabledPlugins].sort()
  }
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
        Object.entries(lock.bundles).map(([slug, b]) => [slug, {
          sha: b.sha,
          files: sortedEntries(b.files),
          ...(b.env?.length ? { env: [...b.env].sort() } : {}),
          ...(b.gitignore?.length ? { gitignore: [...b.gitignore].sort() } : {}),
          ...(b.settings ? { settings: { local: serializeContribution(b.settings.local), shared: serializeContribution(b.settings.shared) } } : {})
        }])
      )
    ),
    scaffolds: sortedEntries(lock.scaffolds),
    blocks: sortedEntries(lock.blocks),
    ...(lock.envExample ? { envExample: lock.envExample } : {})
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
