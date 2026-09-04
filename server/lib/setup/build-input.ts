import { z } from 'zod'
import type { CliManifest } from '../../../shared/types/setup'
import { resolveBundles, validateAnswers } from '../../../shared/setup/wizard'

export const PROJECT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
export const buildInputSchema = z.object({
  projectName: z.string(),
  answers: z.record(z.string(), z.string()),
  bundles: z.array(z.string()).max(50)
})
export type BuildInput = z.infer<typeof buildInputSchema>

export function validateBuildInput(input: unknown, manifest: CliManifest): { ok: true, value: BuildInput } | { ok: false, status: 400, message: string } {
  const parsed = buildInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, status: 400, message: `body: ${parsed.error.issues[0]?.message ?? 'invalid'}` }
  const v = parsed.data
  if (!PROJECT_NAME_RE.test(v.projectName)) return { ok: false, status: 400, message: `projectName: must match ${PROJECT_NAME_RE.source}` }
  const dup = v.bundles.find((s, i) => v.bundles.indexOf(s) !== i)
  if (dup) return { ok: false, status: 400, message: `bundles: duplicate ${dup}` }
  if (manifest.base) {
    const errors = validateAnswers(manifest.base, v.answers)
    if (errors.length) return { ok: false, status: 400, message: errors[0]! }
  }
  const { missing } = resolveBundles(v.bundles, manifest.skills)
  if (missing.length) return { ok: false, status: 400, message: `unknown bundle: ${missing.join(', ')}` }
  return { ok: true, value: v }
}
