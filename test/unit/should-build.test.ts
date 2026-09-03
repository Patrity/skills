import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../scripts/should-build.sh', import.meta.url))

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe' }).toString()
}

function repoWith(commits: string[][]): string {
  const cwd = mkdtempSync(join(tmpdir(), 'should-build-'))
  git(cwd, 'init', '-q', '-b', 'main')
  for (const files of commits) {
    for (const f of files) {
      mkdirSync(join(cwd, f, '..'), { recursive: true })
      writeFileSync(join(cwd, f), String(Math.random()))
    }
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-q', '-m', files.join(','))
  }
  return cwd
}

function run(cwd: string) {
  return spawnSync('bash', [script], { cwd, encoding: 'utf8' }).status
}

describe('scripts/should-build.sh', () => {
  it('skips (exit 0) when only skills/** changed', () => {
    expect(run(repoWith([['app/a.ts'], ['skills/nuxt/README.md']]))).toBe(0)
  })
  it('skips when only docs/** and the root README changed', () => {
    expect(run(repoWith([['app/a.ts'], ['docs/x.md', 'README.md']]))).toBe(0)
  })
  it('builds (exit 1) when app files changed alongside skills', () => {
    expect(run(repoWith([['app/a.ts'], ['skills/nuxt/README.md', 'app/b.ts']]))).toBe(1)
  })
  it('builds when content/docs changed (app content, not bundle content)', () => {
    expect(run(repoWith([['app/a.ts'], ['content/docs/getting-started.md']]))).toBe(1)
  })
  it('builds on the first commit', () => {
    expect(run(repoWith([['skills/nuxt/README.md']]))).toBe(1)
  })
})
