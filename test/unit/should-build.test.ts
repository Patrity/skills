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

/** VERCEL_GIT_PREVIOUS_SHA is deliberately cleared unless a case sets it. */
function runResult(cwd: string, env: Record<string, string> = {}) {
  const { VERCEL_GIT_PREVIOUS_SHA: _ignored, ...rest } = process.env
  return spawnSync('bash', [script], { cwd, encoding: 'utf8', env: { ...rest, ...env } })
}

function run(cwd: string, env: Record<string, string> = {}) {
  return runResult(cwd, env).status
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
  it('skips when only agent config, repo CLAUDE.md or workflows changed', () => {
    expect(run(repoWith([['app/a.ts'], ['CLAUDE.md', '.claude/rules/x.md', '.github/workflows/ci.yml']]))).toBe(0)
  })
  it('skips when only cli/** changed (the CLI is published separately)', () => {
    expect(run(repoWith([['app/a.ts'], ['cli/src/index.ts']]))).toBe(0)
  })
  it('builds when content/docs changed (app content, not bundle content)', () => {
    expect(run(repoWith([['app/a.ts'], ['content/docs/getting-started.md']]))).toBe(1)
  })
  it('builds on the first commit', () => {
    expect(run(repoWith([['skills/nuxt/README.md']]))).toBe(1)
  })

  describe('with VERCEL_GIT_PREVIOUS_SHA (a push of several commits)', () => {
    const threeCommits = () => repoWith([['app/a.ts'], ['app/b.ts'], ['skills/nuxt/README.md']])

    it('builds when an app commit sits behind a skills-only tip', () => {
      const cwd = threeCommits()
      const base = git(cwd, 'rev-parse', 'HEAD~2').trim()
      expect(run(cwd, { VERCEL_GIT_PREVIOUS_SHA: base })).toBe(1)
    })

    it('falls back to HEAD^ when the variable is unset', () => {
      expect(run(threeCommits())).toBe(0)
    })

    it('builds (does not fall back to HEAD^) when the variable points at an unknown commit and there is no fetchable origin', () => {
      const cwd = threeCommits()
      const missing = '0'.repeat(40)
      const result = runResult(cwd, { VERCEL_GIT_PREVIOUS_SHA: missing })
      expect(result.status).toBe(1)
      expect(result.stdout).toContain(`previous deployed commit ${missing} is not available, building`)
    })

    it('builds on a redeploy of the already-deployed commit (e.g. after env changes)', () => {
      const cwd = threeCommits()
      const head = git(cwd, 'rev-parse', 'HEAD').trim()
      expect(run(cwd, { VERCEL_GIT_PREVIOUS_SHA: head })).toBe(1)
    })

    it('fetches the previous sha from origin when missing from a shallow clone, then diffs against it', () => {
      // Simulate Vercel's shallow clone: a full "origin" repo with an app commit (c1, the
      // previously deployed sha) followed by another app commit (c2) and a docs-only tip (c3).
      // A shallow clone only carrying c2..c3 is missing c1 locally but has `origin` configured,
      // so the script should fetch it and correctly see the app change in c2 and build --
      // rather than falling back to HEAD^ (c2) and comparing against a docs-only diff.
      const full = repoWith([['app/a.ts'], ['app/b.ts'], ['app/c.ts'], ['CLAUDE.md']])
      const base = git(full, 'rev-parse', 'HEAD~2').trim()
      const shallow = mkdtempSync(join(tmpdir(), 'should-build-shallow-'))
      execFileSync('git', ['clone', '--quiet', '--depth', '2', '--no-local', `file://${full}`, shallow], { stdio: 'pipe' })

      expect(run(shallow, { VERCEL_GIT_PREVIOUS_SHA: base })).toBe(1)
    })
  })
})
