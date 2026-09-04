import { findMarkerBlocks } from '../../shared/setup/markers'
import type { CliManifest } from '../../shared/types/setup'
import { applyPlan } from './apply'
import { diffOwnedFiles, sha256, type Lockfile } from './lockfile'
import { buildPlan, hashForSource, type SetupPlan } from './plan'
import { readProject, type ProjectState } from './project'
import { askAxes, askBundles, confirmPlan, resolveConflicts } from './prompts'
import { createRegistryClient, type BundleFiles, type RegistryClient } from './registry'
import { applyProfile, defaultAnswers, parseAnswerFlags, preselectedBundles, resolveBundles, validateAnswers } from './wizard'

export const DEFAULT_REGISTRY = 'https://skills.patrity.com'
export const NO_LOCKFILE = 'no .claude/skills.lock.json here — run `skills init` first'

/** `--registry` flag → the lockfile's registry → production. */
export const registryFor = (flag: string | undefined, lock: Lockfile | null): string => flag || lock?.registry || DEFAULT_REGISTRY

export interface CommonOpts {
  dir: string
  registry?: string
  yes: boolean
  force: boolean
  json: boolean
  fetchImpl?: typeof fetch
  /** Overrides the TTY sniff; the tests always pass `false`. */
  interactive?: boolean
}

export interface DiffReport {
  modified: string[]
  missing: string[]
  upstream: { slug: string, installed: string, latest: string }[]
  handEdited: string[]
}

export interface ListReport {
  bundles: string[]
  answers: Record<string, string>
  registry: string
  upstreamSha: string
  installedSha: string
}

const isInteractive = (opts: CommonOpts): boolean => opts.interactive ?? (!opts.yes && Boolean(process.stdout.isTTY))

/** `--json` is the whole of stdout: one object, printed once, by whichever command produced it. */
const emit = (opts: CommonOpts, value: unknown): void => {
  if (opts.json) console.log(JSON.stringify(value))
}

const clientFor = (opts: CommonOpts, lock: Lockfile | null): RegistryClient =>
  createRegistryClient(registryFor(opts.registry, lock), { fetchImpl: opts.fetchImpl })

function requireLock(project: ProjectState): Lockfile {
  if (!project.lock) throw new Error(NO_LOCKFILE)
  return project.lock
}

async function download(client: RegistryClient, slugs: string[]): Promise<Record<string, BundleFiles>> {
  const out: Record<string, BundleFiles> = {}
  await Promise.all(slugs.map(async (slug) => {
    out[slug] = await client.download(slug)
  }))
  return out
}

/** Resolve, download, plan, then write — the tail every mutating command shares. */
async function render(
  opts: CommonOpts,
  project: ProjectState,
  manifest: CliManifest,
  client: RegistryClient,
  answers: Record<string, string>,
  bundles: string[]
): Promise<SetupPlan> {
  const resolved = resolveBundles(bundles, manifest.skills)
  if (resolved.missing.length) throw new Error(`unknown bundle: ${resolved.missing.join(', ')}`)
  const bundleFiles = await download(client, resolved.bundles)
  const plan = await buildPlan({ manifest, project, answers, bundles: resolved.bundles, bundleFiles, force: opts.force })

  const interactive = isInteractive(opts)
  // Without a prompt a conflicting file is never overwritten: it belongs to someone else.
  const overwrite = interactive ? await resolveConflicts(plan) : new Set<string>()
  if (interactive && !(await confirmPlan(plan))) return plan

  const result = await applyPlan(plan, opts.dir, { overwrite })
  emit(opts, { ...result, warnings: plan.warnings, handEdited: plan.claudeMd.handEdited })
  return plan
}

/** `add`/`remove`/`update`: re-render every kept bundle from the lockfile's recorded answers. */
async function fromLock(opts: CommonOpts, select: (lock: Lockfile) => string[]): Promise<SetupPlan> {
  const project = await readProject(opts.dir)
  const lock = requireLock(project)
  const bundles = select(lock) // validated before a single request goes out
  const client = clientFor(opts, lock)
  const manifest = await client.manifest()
  return render(opts, project, manifest, client, lock.answers, bundles)
}

export async function runInit(opts: CommonOpts & { profile?: string, with?: string[], answers?: string[] }): Promise<SetupPlan> {
  const project = await readProject(opts.dir)
  const client = clientFor(opts, project.lock)
  const manifest = await client.manifest()
  if (!manifest.base) throw new Error('the registry has no base schema')

  const profile = opts.profile ? manifest.profiles.find(p => p.name === opts.profile) : undefined
  if (opts.profile && !profile) {
    throw new Error(`unknown profile: ${opts.profile} (available: ${manifest.profiles.map(p => p.name).join(', ')})`)
  }

  let answers = { ...applyProfile(manifest.base, profile, defaultAnswers(manifest.base)), ...parseAnswerFlags(opts.answers ?? []) }
  const errors = validateAnswers(manifest.base, answers)
  if (errors.length) throw new Error(errors.join('; '))

  const interactive = isInteractive(opts)
  if (interactive) answers = await askAxes(manifest.base, answers)
  let bundles = [...new Set([...preselectedBundles(manifest.base, answers, profile, manifest.skills), ...(opts.with ?? [])])]
  if (interactive) bundles = (await askBundles(manifest.skills, bundles, profile ? [] : manifest.profiles)).bundles

  return render(opts, project, manifest, client, answers, bundles)
}

export function runAdd(opts: CommonOpts & { slugs: string[] }): Promise<SetupPlan> {
  return fromLock(opts, lock => [...Object.keys(lock.bundles), ...opts.slugs])
}

export function runRemove(opts: CommonOpts & { slugs: string[] }): Promise<SetupPlan> {
  return fromLock(opts, (lock) => {
    for (const slug of opts.slugs) if (!(slug in lock.bundles)) throw new Error(`${slug} is not installed`)
    return Object.keys(lock.bundles).filter(slug => !opts.slugs.includes(slug))
  })
}

export function runUpdate(opts: CommonOpts & { slugs?: string[] }): Promise<SetupPlan> {
  return fromLock(opts, (lock) => {
    // Naming a slug only narrows what must be installed: the plan is always a full re-render.
    for (const slug of opts.slugs ?? []) if (!(slug in lock.bundles)) throw new Error(`${slug} is not installed`)
    return Object.keys(lock.bundles)
  })
}

export async function runDiff(opts: CommonOpts): Promise<DiffReport> {
  const project = await readProject(opts.dir)
  const lock = requireLock(project)
  const client = clientFor(opts, lock)
  const manifest = await client.manifest({ allowErrors: true })

  const owned = [...Object.values(lock.bundles).flatMap(b => Object.keys(b.files)), ...Object.keys(lock.scaffolds)]
  const hashes = new Map<string, string>()
  for (const path of owned) {
    const bytes = await project.files(path)
    if (bytes) hashes.set(path, sha256(bytes))
  }
  const files = diffOwnedFiles(lock, path => hashes.get(path) ?? null)

  const blocks = project.claudeMd ? findMarkerBlocks(project.claudeMd) : []
  const handEdited = [...new Set(blocks.map(b => b.sourceId))]
    .filter(id => lock.blocks[id] !== undefined && lock.blocks[id] !== hashForSource(blocks, id))
    .sort()

  const upstream = Object.entries(lock.bundles)
    .filter(([, b]) => b.sha !== manifest.sha)
    .map(([slug, b]) => ({ slug, installed: b.sha, latest: manifest.sha }))

  const result: DiffReport = { ...files, upstream, handEdited }
  emit(opts, result)
  return result
}

export async function runList(opts: CommonOpts): Promise<ListReport> {
  const project = await readProject(opts.dir)
  const lock = requireLock(project)
  const client = clientFor(opts, lock)
  const manifest = await client.manifest({ allowErrors: true })

  const result: ListReport = {
    bundles: Object.keys(lock.bundles).sort(),
    answers: lock.answers,
    registry: lock.registry,
    upstreamSha: manifest.sha,
    installedSha: Object.values(lock.bundles)[0]?.sha ?? ''
  }
  emit(opts, result)
  return result
}
