import { createFsSource } from '../server/lib/skills/fs-source'

const dir = process.argv[2] ?? 'skills'
const snapshot = await createFsSource(dir).load()

if (snapshot.skills.length === 0) {
  console.error(`validate-skills: no bundles found under ${dir}`)
  process.exit(1)
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
}

if (failed) {
  console.error(`\nvalidate-skills: ${failed} bundle(s) failed`)
  process.exit(1)
}
