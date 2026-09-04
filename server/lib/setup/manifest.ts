import type { CliManifest } from '../../../shared/types/setup'
import type { ManifestRecord } from '../skills/store'
import { isPublicSkill } from '../skills/public'

/** The CLI-facing projection of a manifest record: public summaries without trees, base, profiles, errors. */
export function toCliManifest(record: ManifestRecord, registry: string): CliManifest {
  const { meta, skills, base, baseErrors, profiles, profileErrors } = record
  return {
    ...meta,
    registry: registry.replace(/\/$/, ''),
    base,
    profiles,
    skills: skills.filter(s => isPublicSkill(s, meta)).map(({ tree: _tree, ...summary }) => summary),
    errors: [...baseErrors, ...profileErrors]
  }
}
