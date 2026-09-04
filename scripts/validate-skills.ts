import { join } from 'node:path'
import { PLACEHOLDERS } from '../shared/setup/placeholders'
import { createFsSource, readDirFiles } from '../server/lib/skills/fs-source'
import { splitFrontmatter } from '../server/lib/skills/frontmatter'
import { checkPlaceholders, checkRulePaths, placeholderTexts } from '../server/lib/setup/constraints'
import { scanForSecrets } from '../server/lib/setup/secrets'

const dir = process.argv[2] ?? 'skills'
const snapshot = await createFsSource(dir).load()

if (snapshot.skills.length === 0) {
  console.error(`validate-skills: no bundles found under ${dir}`)
  process.exit(1)
}

const decoder = new TextDecoder()
// Nested Claude Code skills, e.g. skills/<bundle>/skills/<name>/SKILL.md.
const SKILL_MD_RE = /^skills\/([^/]+)\/SKILL\.md$/i

/** A directory/frontmatter-name mismatch is a warning, not a validation failure. */
function warnOnNameMismatch(slug: string, files: Record<string, Uint8Array>): void {
  for (const [path, bytes] of Object.entries(files)) {
    const match = SKILL_MD_RE.exec(path)
    if (!match) continue
    const skillDir = match[1]!
    const { data } = splitFrontmatter(decoder.decode(bytes))
    const name = typeof data.name === 'string' ? data.name : undefined
    if (name && name !== skillDir) {
      console.warn(`⚠ ${slug}: skills/${skillDir}/SKILL.md name "${name}" differs from its directory`)
    }
  }
}

let failed = 0
for (const skill of snapshot.skills) {
  if (skill.errors.length) {
    failed++
    console.error(`✗ ${skill.slug}`)
    for (const err of skill.errors) console.error(`    - ${err}`)
  } else {
    console.log(`✓ ${skill.slug} — ${skill.name} (${skill.fileCount} files; ${skill.badges.join(', ') || 'no badges'})`)
  }
  warnOnNameMismatch(skill.slug, snapshot.files[skill.slug] ?? {})
}

// Base + profiles
if (snapshot.baseErrors.length) {
  failed++
  console.error('✗ base')
  for (const err of snapshot.baseErrors) console.error(`    - ${err}`)
} else if (snapshot.base) {
  console.log(`✓ base (${snapshot.base.axes.length} axes, ${snapshot.profiles.length} profiles)`)
}
if (snapshot.profileErrors.length) {
  failed++
  console.error('✗ profiles')
  for (const err of snapshot.profileErrors) console.error(`    - ${err}`)
}

const baseFiles = await readDirFiles(join(dir, '..', 'base'))
const profileFiles = await readDirFiles(join(dir, '..', 'profiles'))

// Global constraint: every rule carries a non-empty `paths:` list.
const ruleErrors = Object.entries(snapshot.files).flatMap(([slug, files]) => checkRulePaths(files, `skills/${slug}/`))

// Global constraint: every `{{token}}` is one the renderer knows — a placeholder, or a
// text-input axis whose answer becomes a variable of the same name.
const inputAxes = (snapshot.base?.axes ?? []).filter(a => a.input).map(a => a.id)
const texts: Record<string, string> = {}
for (const [slug, files] of Object.entries(snapshot.files)) {
  Object.assign(texts, placeholderTexts(files, `skills/${slug}/`))
}
for (const [path, bytes] of Object.entries(baseFiles)) {
  const scanned = path.startsWith('fragments/') || path.startsWith('always/') || path.startsWith('templates/')
  if (scanned && path.endsWith('.md')) texts[`base/${path}`] = decoder.decode(bytes)
}
for (const axis of snapshot.base?.axes ?? []) {
  for (const option of axis.options ?? []) {
    for (const scaffold of option.scaffolds ?? []) {
      texts[`base/questions.yaml (axis "${axis.id}", option "${option.id}", to)`] = scaffold.to
    }
  }
}
const placeholderErrors = checkPlaceholders(texts, [...PLACEHOLDERS, ...inputAxes])

for (const err of [...ruleErrors, ...placeholderErrors]) {
  failed++
  console.error(`✗ ${err}`)
}

// Secrets and private infrastructure must never be published.
const findings = [
  ...Object.entries(snapshot.files).flatMap(([slug, files]) => scanForSecrets(files, `skills/${slug}/`)),
  ...scanForSecrets(baseFiles, 'base/'),
  ...scanForSecrets(profileFiles, 'profiles/')
]
for (const f of findings) {
  const line = `${f.severity === 'fail' ? '✗' : '⚠'} ${f.path}:${f.line} [${f.rule}] ${f.excerpt}`
  if (f.severity === 'fail') {
    failed++
    console.error(line)
  } else {
    console.warn(line)
  }
}

if (failed) {
  console.error(`\nvalidate-skills: ${failed} problem(s) found`)
  process.exit(1)
}
