import type { SkillManifest, SnapshotMeta } from '../../../shared/types/skills'
import type { BaseSchema, Profile } from '../../../shared/types/setup'

/** Bundle-relative path → file bytes. */
export type BundleFiles = Record<string, Uint8Array>

export interface RawBundle {
  slug: string
  files: BundleFiles
}

export interface RawExtras {
  /** Files under base/, keys relative to it. */
  base: BundleFiles
  /** Files under profiles/, keys relative to it. */
  profiles: BundleFiles
}

export interface Snapshot extends SnapshotMeta {
  /** Every bundle found, valid or not (see `errors`). Sorted by slug. */
  skills: SkillManifest[]
  /** slug → files (already filtered by exclusions). */
  files: Record<string, BundleFiles>
  base: BaseSchema | null
  baseErrors: string[]
  profiles: Profile[]
  profileErrors: string[]
}

export interface SkillsSource {
  load(): Promise<Snapshot>
}
