import { describe, expect, it } from 'vitest'
import { CLI_VERSION } from '../src/version'

describe('CLI_VERSION', () => {
  it('reads the version straight from package.json', () => {
    expect(CLI_VERSION).toBe('0.1.0')
  })
})
