import type { FileKind, SkillManifest, SnapshotMeta } from '../../../shared/types/skills'
import type { BundleFiles, RawBundle, Snapshot } from './types'
import { parseFrontmatter, SLUG_RE } from './frontmatter'
import { isExcludedPath, MAX_FILE_BYTES } from './exclusions'
import { isBinary } from './sniff'
import { buildTree, deriveBadges } from './tree'

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
    badges: deriveBadges(paths),
    fileCount: paths.length,
    totalBytes,
    tree: buildTree(entries),
    errors
  }
  return { manifest, files }
}

export function buildSnapshot(bundles: RawBundle[], meta: SnapshotMeta): Snapshot {
  const skills: SkillManifest[] = []
  const files: Record<string, BundleFiles> = {}
  for (const bundle of [...bundles].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const parsed = parseBundle(bundle)
    skills.push(parsed.manifest)
    files[bundle.slug] = parsed.files
  }
  return { ...meta, skills, files }
}
