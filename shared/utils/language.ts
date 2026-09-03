import type { Language } from '../types/skills'

const BY_EXT: Record<string, Language> = {
  md: 'markdown',
  markdown: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell'
}

export function detectLanguage(path: string): Language {
  const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return 'plaintext'
  return BY_EXT[base.slice(dot + 1)] ?? 'plaintext'
}

export function isMarkdownPath(path: string): boolean {
  return detectLanguage(path) === 'markdown'
}
