import type { SkillSummary, SnapshotMeta } from './skills'

export interface SectionDef {
  id: string
  title: string
}

export interface BaseOption {
  id: string
  label: string
  description?: string
  /** Path under base/fragments, e.g. "pm/pnpm.md". Optional: some options add nothing. */
  fragment?: string
  /** Bundle slugs this option auto-selects in the wizard. */
  selects?: string[]
  /** Files the wizard writes into the project when this option is chosen. */
  scaffolds?: { template: string, to: string, mode?: 'create' | 'append' }[]
}

export interface BaseAxis {
  id: string
  question: string
  description?: string
  /** Follow-up axis: asked only when `axis` was answered with `option`. */
  when?: { axis: string, option: string }
  /** Select-style axis. */
  options?: BaseOption[]
  default?: string
  /** Text-style axis (no options). Its answer becomes a placeholder variable of the same id. */
  input?: { placeholder: string, default: string }
}

export interface BaseSchema {
  version: number
  sections: SectionDef[]
  axes: BaseAxis[]
  /** "pm/pnpm.md" → markdown (already sectioned with ## headings). */
  fragments: Record<string, string>
  /** "self-improvement.md" → markdown. Every base gets these. */
  always: Record<string, string>
  /** "browser-testing-project.md" → markdown the wizard scaffolds into the project. */
  templates: Record<string, string>
}

/** A variable a bundle reads from `.claude/.env`; the tool writes it into `.claude/.env.example`. */
export interface EnvVar { name: string, description: string, required?: boolean, example?: string }

export interface Profile {
  name: string
  description: string
  answers: Record<string, string>
  bundles: string[]
}

export interface BaseResponse extends SnapshotMeta {
  base: BaseSchema | null
  errors: string[]
}

export interface ProfilesResponse extends SnapshotMeta {
  profiles: Profile[]
  errors: string[]
}

/** Everything the CLI needs in one request. */
export interface CliManifest extends SnapshotMeta {
  registry: string
  base: BaseSchema | null
  profiles: Profile[]
  skills: SkillSummary[]
  errors: string[]
}

/** Bundle-relative path → file bytes, as the registry serves them and the planner renders them. */
export type BundleFiles = Record<string, Uint8Array>

export type { Lockfile, LockBundle, LockSettings } from '../setup/lock'
export type { FileOp, SetupPlan } from '../setup/plan'
