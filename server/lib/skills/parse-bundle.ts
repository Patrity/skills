import type { FileKind, SkillManifest, SnapshotMeta } from '../../../shared/types/skills'
import type { BaseSchema } from '../../../shared/types/setup'
import type { BundleFiles, RawBundle, RawExtras, Snapshot } from './types'
import { parseFrontmatter, SLUG_RE } from './frontmatter'
import { isExcludedPath, MAX_FILE_BYTES } from './exclusions'
import { isBinary } from './sniff'
import { buildTree, deriveBadges } from './tree'
import { parseBaseSchema, validateBaseAgainstSlugs } from '../setup/base'
import { parseProfiles } from '../setup/profiles'
import { splitSnippet } from '../../../shared/setup/sections'

const decoder = new TextDecoder()

export function parseBundle(raw: RawBundle): { manifest: SkillManifest, files: BundleFiles } {
  const errors: string[] = []
  if (!SLUG_RE.test(raw.slug)) errors.push(`slug "${raw.slug}" must match ${SLUG_RE}`)

  const files: BundleFiles = {}
  for (const [path, bytes] of Object.entries(raw.files)) {
    if (!isExcludedPath(path)) files[path] = bytes
  }

  const readmeKey = Object.keys(files).find(p => p.toLowerCase() === 'readme.md')
  let fm = null
  if (!readmeKey) {
    errors.push('README.md is missing')
  } else {
    const parsed = parseFrontmatter(decoder.decode(files[readmeKey]))
    fm = parsed.data
    errors.push(...parsed.errors)
  }

  const claudeKey = Object.keys(files).find(p => p.toLowerCase() === 'claude.md')
  if (claudeKey) {
    for (const e of splitSnippet(decoder.decode(files[claudeKey])).errors) errors.push(`CLAUDE.md: ${e}`)
  }

  const entries: Record<string, { size: number, kind: FileKind }> = {}
  let totalBytes = 0
  for (const [path, bytes] of Object.entries(files)) {
    const kind: FileKind = bytes.byteLength > MAX_FILE_BYTES ? 'oversized' : isBinary(bytes) ? 'binary' : 'text'
    entries[path] = { size: bytes.byteLength, kind }
    totalBytes += bytes.byteLength
  }
  const paths = Object.keys(entries)

  const manifest: SkillManifest = {
    slug: raw.slug,
    name: fm?.name ?? raw.slug,
    description: fm?.description ?? '',
    tags: fm?.tags ?? [],
    author: fm?.author ?? '',
    authorUrl: fm?.authorUrl,
    requires: fm?.requires,
    dependsOn: fm?.dependsOn,
    suggests: fm?.suggests,
    badges: deriveBadges(paths),
    fileCount: paths.length,
    totalBytes,
    tree: buildTree(entries),
    errors
  }
  return { manifest, files }
}

const NO_EXTRAS: RawExtras = { base: {}, profiles: {} }

export function buildSnapshot(bundles: RawBundle[], meta: SnapshotMeta, extras: RawExtras = NO_EXTRAS): Snapshot {
  const skills: SkillManifest[] = []
  const files: Record<string, BundleFiles> = {}
  for (const bundle of [...bundles].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const parsed = parseBundle(bundle)
    skills.push(parsed.manifest)
    files[bundle.slug] = parsed.files
  }

  const slugs = skills.map(s => s.slug)
  for (const skill of skills) {
    for (const [key, list] of [['dependsOn', skill.dependsOn], ['suggests', skill.suggests]] as const) {
      for (const slug of list ?? []) {
        if (!slugs.includes(slug)) skill.errors.push(`${key} references unknown bundle "${slug}"`)
      }
    }
  }

  let base: BaseSchema | null = null
  let baseErrors: string[] = []
  if (Object.keys(extras.base).length) {
    const parsed = parseBaseSchema(extras.base)
    base = parsed.schema
    baseErrors = parsed.errors
    if (base) baseErrors.push(...validateBaseAgainstSlugs(base, slugs))
    if (baseErrors.length) base = null
  }
  const profilesParsed = Object.keys(extras.profiles).length ? parseProfiles(extras.profiles, base, slugs) : { profiles: [], errors: [] }

  return { ...meta, skills, files, base, baseErrors, profiles: profilesParsed.profiles, profileErrors: profilesParsed.errors }
}
