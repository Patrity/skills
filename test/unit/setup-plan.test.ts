import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'
import { toCliManifest } from '../../server/lib/setup/manifest'
import { planFresh } from '../../shared/setup/plan'
import { startMarker } from '../../shared/setup/markers'
import { parseLockfile, serializeLockfile } from '../../shared/setup/lock'

const dir = fileURLToPath(new URL('../fixtures/skills', import.meta.url))
const dec = new TextDecoder()

async function load() {
  const snap = await createFsSource(dir).load()
  const manifest = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'https://example.test')
  return { manifest, files: snap.files }
}

describe('planFresh', () => {
  it('plans a fresh project: every op is create, lock is complete, CLAUDE.md is sectioned', async () => {
    const { manifest, files } = await load()
    const plan = planFresh({ manifest, projectName: 'proj', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: files.demo! }, registry: 'https://example.test' })
    expect(plan.files.every(f => f.action === 'create')).toBe(true)
    expect(plan.removals).toEqual([])
    expect(plan.claudeMd.handEdited).toEqual([])
    expect(plan.claudeMd.content.startsWith('# proj\n')).toBe(true)
    expect(plan.claudeMd.content).toContain(startMarker('base:pm=pnpm'))
    expect(plan.claudeMd.content).toContain(startMarker('bundle:demo'))
    expect(plan.lock.registry).toBe('https://example.test')
    expect(plan.lock.projectName).toBe('proj')
    expect(Object.keys(plan.lock.bundles)).toEqual(['demo'])
    for (const f of plan.files) if (f.owner === 'bundle:demo') expect(plan.lock.bundles.demo!.files[f.path]).toMatch(/^[0-9a-f]{64}$/)
    expect(Object.keys(plan.lock.blocks).length).toBeGreaterThan(0)
    // Round-trips through the lock codec byte for byte.
    const text = serializeLockfile(plan.lock)
    expect(serializeLockfile(parseLockfile(text))).toBe(text)
  })

  it('is deterministic and renders placeholders in text files but not binary ones', async () => {
    const { manifest, files } = await load()
    const input = { manifest, projectName: 'proj', answers: { pm: 'npm', layout: 'monorepo', appDir: 'apps/web/app' }, bundles: ['demo'], bundleFiles: { demo: { ...files.demo!, 'skills/demo/bin.dat': new Uint8Array([0, 1, 2, 0]) } }, registry: 'r' }
    const a = planFresh(input)
    const b = planFresh(input)
    expect(serializeLockfile(a.lock)).toBe(serializeLockfile(b.lock))
    expect(a.claudeMd.content).toBe(b.claudeMd.content)
    const rule = a.files.find(f => f.path.endsWith('.md') && dec.decode(f.bytes).includes('apps/web/app'))
    expect(rule, 'a text file rendered {{appDir}}').toBeDefined()
    expect(a.files.find(f => f.path.endsWith('bin.dat'))!.bytes).toEqual(new Uint8Array([0, 1, 2, 0]))
  })

  it('warns instead of throwing on a malformed settings.json and an unsafe path', async () => {
    const { manifest, files } = await load()
    const enc = new TextEncoder()
    const plan = planFresh({ manifest, projectName: 'p', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: { ...files.demo!, 'settings.json': enc.encode('{ bad'), '../x.md': enc.encode('x') } }, registry: 'r' })
    expect(plan.warnings).toEqual(expect.arrayContaining([expect.stringContaining('demo/settings.json: not valid JSON'), 'demo/../x.md: unsafe path, skipped']))
    expect(plan.files.some(f => f.path.includes('..'))).toBe(false)
  })
})
