import { findMarkerBlocks } from '../../shared/setup/markers'
import type { BaseSchema, CliManifest } from '../../shared/types/setup'
import { applyPlan, type ApplyResult } from './apply'
import { diffOwnedFiles, sha256, type Lockfile } from './lockfile'
import { buildPlan, hashForSource, type SetupPlan } from './plan'
import { readProject, type ProjectState } from './project'
import { askAxes, askBundles, confirmPlan, resolveConflicts } from './prompts'
import { createRegistryClient, type BundleFiles, type RegistryClient } from './registry'
import { applyProfile, defaultAnswers, parseAnswerFlags, preselectedBundles, reconcileAnswers, resolveBundles, validateAnswers } from './wizard'

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

/** What a mutating command did: the plan it built, whether it reached disk, and what it touched. */
export interface RunResult {
  plan: SetupPlan
  applied: boolean
  /** `null` when the plan was never applied (the confirmation was declined). */
  result: ApplyResult | null
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

// `--json` owns stdout, so it never prompts — a clack prompt would write into the JSON.
const isInteractive = (opts: CommonOpts): boolean => opts.interactive ?? (!opts.yes && !opts.json && Boolean(process.stdout.isTTY))

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

/** What a command wants installed, and which of those slugs the registry is allowed to have dropped. */
interface Selection {
  bundles: string[]
  /**
   * Slugs taken from the lockfile rather than typed by the user: a bundle that vanished upstream
   * must not brick `update`/`add`/`remove`, so it is warned about and deselected instead.
   */
  tolerateMissing: string[]
}

/** Resolve, download, plan, then write — the tail every mutating command shares. */
async function render(
  opts: CommonOpts,
  project: ProjectState,
  manifest: CliManifest,
  client: RegistryClient,
  answers: Record<string, string>,
  selection: Selection,
  warnings: string[] = []
): Promise<RunResult> {
  const resolved = resolveBundles(selection.bundles, manifest.skills)
  const tolerated = new Set(selection.tolerateMissing)
  const unknown = resolved.missing.filter(slug => !tolerated.has(slug))
  if (unknown.length) throw new Error(`unknown bundle: ${unknown.join(', ')}`)
  // Gone upstream: dropping it from the selection sends its files down the normal removal path.
  const gone = resolved.missing.filter(slug => tolerated.has(slug))
  const notes = [...warnings, ...gone.map(slug => `${slug} is installed but no longer in the registry; removing its files`)]

  const bundleFiles = await download(client, resolved.bundles)
  // The lockfile records where the bundles actually came from, not the origin the manifest claims.
  const plan = await buildPlan({ manifest, registry: client.registry, project, answers, bundles: resolved.bundles, bundleFiles, force: opts.force })
  // Warnings raised before the plan existed (a stale lockfile, a bundle gone upstream) lead it.
  plan.warnings.unshift(...notes)

  const interactive = isInteractive(opts)
  // Without a prompt a conflicting file is never overwritten: it belongs to someone else.
  const overwrite = interactive ? await resolveConflicts(plan) : new Set<string>()
  if (interactive && !(await confirmPlan(plan, overwrite))) {
    emit(opts, { applied: false, warnings: plan.warnings })
    return { plan, applied: false, result: null }
  }

  const result = await applyPlan(plan, opts.dir, { overwrite })
  emit(opts, { ...result, applied: true, warnings: plan.warnings, handEdited: plan.claudeMd.handEdited })
  return { plan, applied: true, result }
}

/**
 * The recorded answers, reconciled against the schema the registry serves now (§4): a lockfile
 * written by an older CLI, or against an older base, must not silently install a broken setup.
 */
function answersFor(base: BaseSchema | null, lock: Lockfile): { answers: Record<string, string>, warnings: string[] } {
  return base ? reconcileAnswers(base, lock.answers) : { answers: { ...lock.answers }, warnings: [] }
}

/** `add`/`remove`/`update`: re-render every kept bundle from the lockfile's recorded answers. */
async function fromLock(opts: CommonOpts, select: (lock: Lockfile) => Selection): Promise<RunResult> {
  const project = await readProject(opts.dir)
  const lock = requireLock(project)
  const selection = select(lock) // validated against the lockfile before anything is downloaded
  const client = clientFor(opts, lock)
  const manifest = await client.manifest()
  const { answers, warnings } = answersFor(manifest.base, lock)
  return render(opts, project, manifest, client, answers, selection, warnings)
}

export async function runInit(opts: CommonOpts & { profile?: string, with?: string[], answers?: string[] }): Promise<RunResult> {
  const project = await readProject(opts.dir)
  const client = clientFor(opts, project.lock)
  const manifest = await client.manifest()
  const base = manifest.base
  if (!base) throw new Error('the registry has no base schema')

  const profile = opts.profile ? manifest.profiles.find(p => p.name === opts.profile) : undefined
  if (opts.profile && !profile) {
    throw new Error(`unknown profile: ${opts.profile} (available: ${manifest.profiles.map(p => p.name).join(', ')})`)
  }

  // Re-running `init` on an initialised project edits it: the recorded answers are the starting
  // point (a profile, then --answer, override them) and what is installed stays ticked.
  const lock = project.lock
  const recorded = lock ? answersFor(base, lock) : { answers: defaultAnswers(base), warnings: [] }
  let answers = { ...applyProfile(base, profile, recorded.answers), ...parseAnswerFlags(opts.answers ?? []) }
  const errors = validateAnswers(base, answers)
  if (errors.length) throw new Error(errors.join('; '))

  const interactive = isInteractive(opts)
  if (interactive) answers = await askAxes(base, answers)
  const installed = Object.keys(lock?.bundles ?? {})
  let bundles = [...new Set([...preselectedBundles(base, answers, profile, manifest.skills), ...(opts.with ?? []), ...installed])]
  if (interactive) bundles = (await askBundles(manifest.skills, bundles, profile ? [] : manifest.profiles)).bundles

  const named = new Set(opts.with ?? [])
  const selection = { bundles, tolerateMissing: installed.filter(slug => !named.has(slug)) }
  return render(opts, project, manifest, client, answers, selection, recorded.warnings)
}

export function runAdd(opts: CommonOpts & { slugs: string[] }): Promise<RunResult> {
  return fromLock(opts, lock => ({
    bundles: [...Object.keys(lock.bundles), ...opts.slugs],
    // A slug the user typed must exist, even if the lockfile also lists it.
    tolerateMissing: Object.keys(lock.bundles).filter(slug => !opts.slugs.includes(slug))
  }))
}

export function runRemove(opts: CommonOpts & { slugs: string[] }): Promise<RunResult> {
  return fromLock(opts, (lock) => {
    for (const slug of opts.slugs) if (!(slug in lock.bundles)) throw new Error(`${slug} is not installed`)
    const bundles = Object.keys(lock.bundles).filter(slug => !opts.slugs.includes(slug))
    return { bundles, tolerateMissing: bundles }
  })
}

export function runUpdate(opts: CommonOpts & { slugs?: string[] }): Promise<RunResult> {
  return fromLock(opts, (lock) => {
    // Naming a slug only narrows what must be installed: the plan is always a full re-render.
    for (const slug of opts.slugs ?? []) if (!(slug in lock.bundles)) throw new Error(`${slug} is not installed`)
    const bundles = Object.keys(lock.bundles)
    return { bundles, tolerateMissing: bundles }
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
