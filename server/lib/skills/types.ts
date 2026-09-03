import type { SkillManifest, SnapshotMeta } from '../../../shared/types/skills'

/** Bundle-relative path → file bytes. */
export type BundleFiles = Record<string, Uint8Array>

export interface RawBundle {
  slug: string
  files: BundleFiles
}

export interface Snapshot extends SnapshotMeta {
  /** Every bundle found, valid or not (see `errors`). Sorted by slug. */
  skills: SkillManifest[]
  /** slug → files (already filtered by exclusions). */
  files: Record<string, BundleFiles>
}

export interface SkillsSource {
  load(): Promise<Snapshot>
}
