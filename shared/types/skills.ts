import type { MDCRoot } from '@nuxtjs/mdc'
import type { EnvVar } from './setup'

/** Markdown parsed to the MDC AST on the server; `<MDCRenderer :body>` renders it as-is. */
export type MarkdownBody = MDCRoot

/** What `renderMarkdown` produces: the AST plus the frontmatter `<MDCRenderer :data>` interpolates. */
export interface MarkdownRender {
  body: MarkdownBody
  data: Record<string, unknown>
}

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
  /** Bundle slugs that must be installed with this one. */
  dependsOn?: string[]
  /** Bundle slugs the wizard pre-ticks alongside this one. */
  suggests?: string[]
  /** Project-relative paths the tool adds to the managed block in the project's .gitignore. */
  gitignore?: string[]
  /** Variables the bundle's skills read from .claude/.env. */
  env?: EnvVar[]
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

export interface StatusResponse extends SnapshotMeta {
  ok: true
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
  /**
   * Server-parsed MDC AST for markdown; null for every other kind or language, and for
   * markdown too big to be worth rendering (the page falls back to the source view).
   */
  body: MarkdownBody | null
  /** Frontmatter for a rendered markdown file, passed to `<MDCRenderer :data>`. Null with `body`. */
  data: Record<string, unknown> | null
}
