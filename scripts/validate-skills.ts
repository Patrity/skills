import { createFsSource } from '../server/lib/skills/fs-source'
import { splitFrontmatter } from '../server/lib/skills/frontmatter'

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

if (failed) {
  console.error(`\nvalidate-skills: ${failed} bundle(s) failed`)
  process.exit(1)
}
