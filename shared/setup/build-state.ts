import type { CliManifest, Profile } from '../types/setup'
import { applyProfile, defaultAnswers, preselectedBundles, resolveBundles } from './wizard'

/**
 * Everything the `/build` page composes, and the whole of what a share link carries. Node-free on
 * purpose: this module runs in the browser bundle.
 */
export interface BuildState {
  profile: string | null
  projectName: string
  answers: Record<string, string>
  bundles: string[]
}

export const DEFAULT_PROJECT_NAME = 'my-project'

/**
 * What a `projectName` may be. Lives here rather than beside the API's zod schema so the browser
 * can reject a name before the request, and both sides can never disagree about which names pass.
 */
export const PROJECT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/**
 * What a free-text answer may contain. Text-axis answers reach a rendered CLAUDE.md, a scaffold
 * path and the CLI command a user pastes into a shell, and a share link is attacker-controlled
 * input — so the link decoder only accepts path-shaped text and drops the rest.
 */
export const TEXT_ANSWER_RE = /^[A-Za-z0-9._\-/@:+ ]{0,128}$/

/** Characters a shell reads literally, so a value made only of these needs no quoting. */
const SHELL_SAFE_RE = /^[A-Za-z0-9._\-/=:@+,]+$/

/** POSIX single-quoting: everything inside is literal, and `'` is closed, escaped and reopened. */
function shellQuote(value: string): string {
  return SHELL_SAFE_RE.test(value) ? value : `'${value.split('\'').join('\'\\\'\'')}'`
}

const enc = (s: string) => encodeURIComponent(s)
const dec = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * `p=<profile>&n=<name>&a=<axis>:<value>,…&b=<slug>,…` — short enough to read in the address bar,
 * and every value URL-encoded so a path answer survives the round trip.
 */
export function encodeBuildState(s: BuildState): string {
  const parts: string[] = []
  if (s.profile) parts.push(`p=${enc(s.profile)}`)
  parts.push(`n=${enc(s.projectName)}`)
  const a = Object.entries(s.answers).map(([k, v]) => `${enc(k)}:${enc(v)}`).join(',')
  if (a) parts.push(`a=${a}`)
  // Always written, empty included: no `b=` at all means "whatever the wizard would pre-tick",
  // which is a different state from "the user unticked everything".
  parts.push(`b=${s.bundles.map(enc).join(',')}`)
  return parts.join('&')
}

/**
 * The inverse, reconciled against the manifest being served now: an axis, option, bundle or
 * profile the registry no longer has is dropped with a warning rather than poisoning the form.
 * Unanswered axes fall back to the defaults the profile implies, so a partial hash is still a
 * complete state.
 */
export function decodeBuildState(hash: string, manifest: CliManifest): { state: BuildState, warnings: string[] } {
  const warnings: string[] = []
  const params = new Map(hash.replace(/^#/, '').split('&').filter(Boolean).map((kv) => {
    const i = kv.indexOf('=')
    return i === -1 ? ([kv, ''] as const) : ([kv.slice(0, i), kv.slice(i + 1)] as const)
  }))
  const base = manifest.base
  const rawProfile = params.get('p')
  let profile: string | null = rawProfile ? dec(rawProfile) : null
  const prof = profile ? manifest.profiles.find(p => p.name === profile) : undefined
  if (profile && !prof) {
    warnings.push(`unknown profile "${profile}"`)
    profile = null
  }
  let answers = base ? applyProfile(base, prof, defaultAnswers(base)) : {}
  for (const pair of (params.get('a') ?? '').split(',').filter(Boolean)) {
    const i = pair.indexOf(':')
    const id = dec(i === -1 ? pair : pair.slice(0, i))
    const value = i === -1 ? '' : dec(pair.slice(i + 1))
    const axis = base?.axes.find(x => x.id === id)
    if (!axis) {
      warnings.push(`unknown axis "${id}"`)
      continue
    }
    if (axis.options && !axis.options.some(o => o.id === value)) {
      warnings.push(`${id}: "${value}" is not an option`)
      continue
    }
    // A select answer is one of the schema's own option ids; a text one is whatever the link says.
    if (!axis.options && !TEXT_ANSWER_RE.test(value)) {
      warnings.push(`${id}: value contains unsupported characters`)
      continue
    }
    answers = { ...answers, [id]: value }
  }
  const wanted = (params.get('b') ?? '').split(',').filter(Boolean).map(dec)
  const known = new Set(manifest.skills.map(s => s.slug))
  for (const slug of wanted) if (!known.has(slug)) warnings.push(`unknown bundle "${slug}"`)
  // No `b=` means "whatever the wizard would pre-tick"; an empty `b=` means the user unticked
  // everything, which `filter` preserves. Either way the list is closed over `dependsOn`, so the
  // form can never show a locked-but-unticked row for a bundle the plan installs anyway.
  const bundles = resolveBundles(
    params.has('b')
      ? wanted.filter(s => known.has(s))
      : (base ? preselectedBundles(base, answers, prof, manifest.skills) : []),
    manifest.skills
  ).bundles
  // The name reaches the rendered preview as `# <name>`, and the MDC pipeline behind
  // `/api/build/render` keeps raw HTML (minus scripts) — so a link-supplied name gets the same
  // door as every other link-supplied value rather than being trusted for being "just a title".
  const rawName = params.get('n')
  const name = rawName ? dec(rawName) : ''
  if (rawName && !PROJECT_NAME_RE.test(name)) warnings.push('projectName: value contains unsupported characters')
  return {
    state: {
      profile,
      projectName: rawName && PROJECT_NAME_RE.test(name) ? name : DEFAULT_PROJECT_NAME,
      answers,
      bundles
    },
    warnings
  }
}

/** What `init` would pre-tick for these answers under this profile, closed over `dependsOn`. */
function preselectionFor(s: BuildState, manifest: CliManifest, prof: Profile | undefined): string[] {
  const base = manifest.base
  return base ? resolveBundles(preselectedBundles(base, s.answers, prof, manifest.skills), manifest.skills).bundles : []
}

/**
 * The CLI invocation that reproduces this state, with nothing the wizard would infer anyway.
 * Every interpolated value is shell-quoted: this string is written to the clipboard for the user
 * to paste into a shell, and an answer can come from a link someone else wrote.
 *
 * `--profile` is only ever emitted when the state keeps everything the profile would pre-tick.
 * Unticking one of them means the profile no longer describes this state, so it is dropped and the
 * answers are spelled out against the schema defaults instead — otherwise the pasted command would
 * silently reinstall the bundle the user just removed. An option's own `selects` (and a bundle's
 * `suggests`) can still pull one back; only `remove` or the zip avoids that.
 */
export function cliCommand(s: BuildState, manifest: CliManifest): string {
  const base = manifest.base
  const named = s.profile ? manifest.profiles.find(p => p.name === s.profile) : undefined
  const keepsProfile = preselectionFor(s, manifest, named).every(b => s.bundles.includes(b))
  const prof = keepsProfile ? named : undefined
  const implied = base ? applyProfile(base, prof, defaultAnswers(base)) : {}
  const parts = ['pnpx @patrity/skills init --yes']
  if (prof) parts.push(`--profile ${shellQuote(prof.name)}`)
  const preselected = preselectionFor(s, manifest, prof)
  const extra = s.bundles.filter(b => !preselected.includes(b))
  if (extra.length) parts.push(`--with ${shellQuote(extra.join(','))}`)
  for (const [k, v] of Object.entries(s.answers)) {
    if (implied[k] !== v) parts.push(`--answer ${shellQuote(k)}=${shellQuote(v)}`)
  }
  return parts.join(' ')
}
