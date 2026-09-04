import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import type { BaseSchema, Profile } from '../../../shared/types/setup'

const decoder = new TextDecoder()

const profileSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().min(1),
  answers: z.record(z.string(), z.string()).default({}),
  bundles: z.array(z.string()).default([])
})

export function parseProfiles(files: Record<string, Uint8Array>, schema: BaseSchema | null, slugs: string[]): { profiles: Profile[], errors: string[] } {
  const profiles: Profile[] = []
  const errors: string[] = []
  const known = new Set(slugs)

  for (const path of Object.keys(files).sort()) {
    if (!path.endsWith('.yaml') && !path.endsWith('.yml')) continue
    const label = `profiles/${path}`
    const fileName = path.replace(/\.ya?ml$/, '')
    let raw: unknown
    try {
      raw = parseYaml(decoder.decode(files[path]!))
    } catch (err) {
      errors.push(`${label}: invalid YAML: ${(err as Error).message.split('\n')[0]}`)
      continue
    }
    const parsed = profileSchema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${label}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      continue
    }
    const profile = parsed.data
    let ok = true
    if (profile.name !== fileName) {
      errors.push(`${label}: name "${profile.name}" must match the file name "${fileName}"`)
      ok = false
    }
    for (const [axisId, value] of Object.entries(profile.answers)) {
      const axis = schema?.axes.find(a => a.id === axisId)
      if (!axis) {
        errors.push(`${label}: answer for unknown axis "${axisId}"`)
        ok = false
      } else if (axis.options && !axis.options.some(o => o.id === value)) {
        errors.push(`${label}: answer ${axisId}="${value}" is not an option`)
        ok = false
      }
    }
    for (const slug of profile.bundles) {
      if (!known.has(slug)) {
        errors.push(`${label}: unknown bundle "${slug}"`)
        ok = false
      }
    }
    if (ok) profiles.push(profile)
  }
  return { profiles, errors }
}
