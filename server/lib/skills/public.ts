import type { SkillManifest, SnapshotMeta } from '../../../shared/types/skills'

/** Invalid bundles are visible (with their errors) only when reading from disk. */
export function isPublicSkill(skill: SkillManifest, meta: SnapshotMeta): boolean {
  return meta.source === 'fs' || skill.errors.length === 0
}
