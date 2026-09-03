export type ContentBadge = 'skills' | 'rules' | 'hooks' | 'settings' | 'claude-md'
export type FileKind = 'text' | 'binary' | 'oversized'
export type Language
  = 'markdown' | 'json' | 'yaml' | 'typescript' | 'javascript' | 'python' | 'shell' | 'plaintext'

export interface SkillFrontmatter {
  name: string
  description: string
  tags: string[]
  author: string
  authorUrl?: string
  requires?: string[]
}

export interface TreeNode {
  /** Basename, e.g. "SKILL.md". */
  name: string
  /** Path relative to the bundle root, e.g. "skills/nuxt-docs/SKILL.md". */
  path: string
  type: 'file' | 'dir'
  size?: number
  kind?: FileKind
  children?: TreeNode[]
}

export interface SkillManifest extends SkillFrontmatter {
  slug: string
  badges: ContentBadge[]
  fileCount: number
  totalBytes: number
  tree: TreeNode[]
  /** Validation problems. Empty for a publishable bundle. */
  errors: string[]
}

export type SkillSummary = Omit<SkillManifest, 'tree'>

export interface SnapshotMeta {
  sha: string
  committedAt: string
  fetchedAt: string
  source: 'fs' | 'github'
}

export interface SkillsListResponse extends SnapshotMeta {
  skills: SkillSummary[]
}

export interface SkillDetailResponse extends SnapshotMeta {
  skill: SkillManifest
}

export interface SkillFileResponse {
  path: string
  language: Language
  size: number
  kind: FileKind
  /** Decoded text for kind === 'text', otherwise null. */
  content: string | null
  /** Raw YAML between the --- fences for markdown files that have frontmatter. */
  frontmatterRaw: string | null
}
