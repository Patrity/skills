import { describe, expect, it } from 'vitest'
import { buildPlan } from '../../src/plan'
import { emptyLockfile, sha256 } from '../../src/lockfile'
import type { ProjectState } from '../../src/project'
import { fixtureManifest } from '../helpers/fixtures'

const manifest = fixtureManifest()
const enc = (s: string) => new TextEncoder().encode(s)
const answers = { pm: 'pnpm', layout: 'single', browser: 'none' }

/**
 * The order the CLI prints its warnings in: what rendering found (unsafe paths, bad placeholders,
 * malformed settings), then what the previous lock left behind, then what the CLAUDE.md snippets
 * complained about. Rendering moved into shared/setup, so this pins the order across that seam.
 */
describe('buildPlan (warning order)', () => {
  it('emits render warnings, then removal warnings, then contribution warnings', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'x', files: { '.claude/rules/old.md': sha256('installed') } }
    const disk: Record<string, string> = { '.claude/rules/old.md': 'edited by hand' }
    const project: ProjectState = {
      dir: '/tmp/p',
      name: 'proj',
      claudeMd: null,
      settings: null,
      settingsLocal: null,
      gitignore: null,
      lock,
      files: async rel => (rel in disk ? enc(disk[rel]!) : null)
    }
    const plan = await buildPlan({
      manifest,
      registry: manifest.registry,
      project,
      answers,
      bundles: ['demo'],
      bundleFiles: {
        demo: {
          '../evil.md': enc('pwned'), // render: unsafe path
          'CLAUDE.md': enc('## Commands\n- `{{mystery}}` runs the demo.\n'), // contribution: unknown placeholder
          'rules/x.md': enc('fine')
        }
      }
    })
    expect(plan.warnings).toEqual([
      'demo/../evil.md: unsafe path, skipped',
      '.claude/rules/old.md was modified after install; left in place (remove it by hand)',
      'bundle:demo CLAUDE.md: unknown placeholder {{mystery}}'
    ])
  })
})
