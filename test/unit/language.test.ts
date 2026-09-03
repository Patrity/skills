import { describe, expect, it } from 'vitest'
import { detectLanguage, isMarkdownPath } from '../../shared/utils/language'

describe('detectLanguage', () => {
  it.each([
    ['README.md', 'markdown'],
    ['docs/guide.markdown', 'markdown'],
    ['settings.local.json', 'json'],
    ['hooks/config.yaml', 'yaml'],
    ['hooks/config.yml', 'yaml'],
    ['scripts/run.ts', 'typescript'],
    ['scripts/run.mts', 'typescript'],
    ['scripts/run.js', 'javascript'],
    ['scripts/run.mjs', 'javascript'],
    ['skills/x/fetch.py', 'python'],
    ['hooks/pre-commit.sh', 'shell'],
    ['hooks/pre-commit.bash', 'shell'],
    ['LICENSE', 'plaintext'],
    ['weird.unknownext', 'plaintext']
  ])('%s → %s', (path, lang) => {
    expect(detectLanguage(path)).toBe(lang)
  })

  it('is case-insensitive on the extension', () => {
    expect(detectLanguage('CLAUDE.MD')).toBe('markdown')
  })
})

describe('isMarkdownPath', () => {
  it('matches only markdown extensions', () => {
    expect(isMarkdownPath('a/b.md')).toBe(true)
    expect(isMarkdownPath('a/b.json')).toBe(false)
  })
})
