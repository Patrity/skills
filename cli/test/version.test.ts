import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CLI_VERSION } from '../src/version'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

describe('CLI_VERSION', () => {
  it('reads the version straight from package.json', () => {
    expect(CLI_VERSION).toBe(pkg.version)
    expect(CLI_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})
