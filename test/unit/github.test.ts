import { describe, expect, it } from 'vitest'
import { githubBlobUrl, githubRepoUrl, githubTreeUrl } from '../../shared/utils/github'

const ref = { owner: 'Patrity', repo: 'skills', branch: 'main' }

describe('github urls', () => {
  it('builds the repo url', () => {
    expect(githubRepoUrl(ref)).toBe('https://github.com/Patrity/skills')
  })
  it('builds a bundle tree url on the production branch', () => {
    expect(githubTreeUrl(ref, 'nuxt')).toBe('https://github.com/Patrity/skills/tree/main/skills/nuxt')
  })
  it('builds a file blob url and encodes path segments', () => {
    expect(githubBlobUrl(ref, 'nuxt', 'skills/nuxt docs/SKILL.md'))
      .toBe('https://github.com/Patrity/skills/blob/main/skills/nuxt/skills/nuxt%20docs/SKILL.md')
  })
})
