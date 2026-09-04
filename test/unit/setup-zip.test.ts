import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'
import { toCliManifest } from '../../server/lib/setup/manifest'
import { planFresh } from '../../shared/setup/plan'
import { buildSetupZip, setupZipEntries } from '../../server/lib/setup/setup-zip'

const dir = fileURLToPath(new URL('../fixtures/skills', import.meta.url))

describe('buildSetupZip', () => {
  it('contains exactly the plan, with hook modes, in sorted order, deterministically', async () => {
    const snap = await createFsSource(dir).load()
    const manifest = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'r')
    const plan = planFresh({ manifest, projectName: 'p', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: snap.files.demo! }, registry: 'r' })
    const entries = setupZipEntries(plan)
    expect(entries.map(e => e.path)).toEqual([...entries.map(e => e.path)].sort())
    expect(entries.map(e => e.path)).toEqual(expect.arrayContaining(['CLAUDE.md', '.gitignore', '.claude/.env.example', '.claude/skills.lock.json', '.claude/settings.json', '.claude/settings.local.json']))
    const zip = buildSetupZip(plan, new Date('2026-09-04T00:00:00Z'))
    expect(buildSetupZip(plan, new Date('2026-09-04T00:00:00Z'))).toEqual(zip)
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual(entries.map(e => e.path))
    expect(new TextDecoder().decode(files['CLAUDE.md']!)).toBe(plan.claudeMd.content)
  })
  it('marks hook scripts executable', async () => {
    // fflate exposes no attrs on unzip; assert through the raw central directory: external attrs high 16 bits = 0o100755
    const snap = await createFsSource(dir).load()
    const manifest = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'r')
    const plan = planFresh({ manifest, projectName: 'p', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: snap.files.demo! }, registry: 'r' })
    const hook = setupZipEntries(plan).find(e => e.path.startsWith('.claude/hooks/'))
    expect(hook?.mode).toBe(0o755)
    const zip = buildSetupZip(plan, new Date(0))
    // central directory header signature 0x02014b50; external attrs at offset 38 of each header
    const text = Buffer.from(zip)
    let found = false
    for (let i = 0; i + 46 < text.length; i++) {
      if (text.readUInt32LE(i) !== 0x02014b50) continue
      const nameLen = text.readUInt16LE(i + 28)
      const name = text.toString('utf8', i + 46, i + 46 + nameLen)
      if (name === hook!.path) {
        expect(text.readUInt32LE(i + 38) >>> 16).toBe(0o100755)
        found = true
      }
    }
    expect(found).toBe(true)
  })
})
