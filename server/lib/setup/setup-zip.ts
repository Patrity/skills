import { zipSync, type Zippable } from 'fflate'
import type { SetupPlan } from '../../../shared/types/setup'
import { serializeLockfile } from '../../../shared/setup/lock'
import { ENV_EXAMPLE_PATH } from '../../../shared/setup/env-example'

const enc = new TextEncoder()

export function setupZipEntries(plan: SetupPlan): { path: string, bytes: Uint8Array, mode?: number }[] {
  const out = plan.files.map(f => ({ path: f.path, bytes: f.bytes, ...(f.mode ? { mode: f.mode } : {}) }))
  out.push({ path: 'CLAUDE.md', bytes: enc.encode(plan.claudeMd.content) })
  if (plan.settings) out.push({ path: '.claude/settings.json', bytes: enc.encode(plan.settings.content) })
  if (plan.settingsLocal) out.push({ path: '.claude/settings.local.json', bytes: enc.encode(plan.settingsLocal.content) })
  if (plan.gitignore) out.push({ path: '.gitignore', bytes: enc.encode(plan.gitignore.content) })
  if (plan.envExample) out.push({ path: ENV_EXAMPLE_PATH, bytes: enc.encode(plan.envExample.content) })
  out.push({ path: '.claude/skills.lock.json', bytes: enc.encode(serializeLockfile(plan.lock)) })
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

// The zip DOS date field only spans 1980-2099, checked by fflate against the LOCAL calendar year
// (`Date#getFullYear`), so the bounds must be local-time constructions too, not UTC ones that could
// fall a day either side of the boundary west or east of UTC. Guards a commit epoch of 0 (1970).
const ZIP_DATE_MIN = new Date(1980, 0, 1)
const ZIP_DATE_MAX = new Date(2099, 11, 31, 23, 59, 58)
const clampZipDate = (d: Date): Date => (d < ZIP_DATE_MIN ? ZIP_DATE_MIN : d > ZIP_DATE_MAX ? ZIP_DATE_MAX : d)

/** Deterministic: sorted entries, fixed mtime, level 6; hook scripts carry 0755 in the external attributes. */
export function buildSetupZip(plan: SetupPlan, mtime: Date): Uint8Array {
  const clamped = clampZipDate(mtime)
  const entries: Zippable = {}
  for (const e of setupZipEntries(plan)) {
    entries[e.path] = [e.bytes, { level: 6, mtime: clamped, ...(e.mode ? { attrs: ((0o100000 | e.mode) << 16) >>> 0, os: 3 } : {}) }]
  }
  return zipSync(entries)
}
