import { describe, expect, it } from 'vitest'
import { renderEnvExample } from '../../shared/setup/env-example'

describe('renderEnvExample', () => {
  it('renders one group per bundle, sorted by slug, with required markers and examples', () => {
    expect(renderEnvExample([
      { slug: 'zeta', env: [{ name: 'Z_KEY', description: 'Zeta key.' }] },
      { slug: 'readonly-db', env: [{ name: 'DATABASE_URL_RO', description: 'Read-only connection string.', required: true, example: 'postgres://<app>_claude_ro:<password>@<host>/<db>' }] }
    ])).toBe([
      '# Copy this file to .claude/.env and fill in the values. .claude/.env is gitignored; skills read it, never the repo root .env.',
      '',
      '# skills: readonly-db',
      '# Read-only connection string. (required)',
      'DATABASE_URL_RO=postgres://<app>_claude_ro:<password>@<host>/<db>',
      '',
      '# skills: zeta',
      '# Zeta key.',
      'Z_KEY=',
      ''
    ].join('\n'))
  })
  it('returns null when no bundle declares env', () => {
    expect(renderEnvExample([{ slug: 'a', env: [] }])).toBeNull()
  })
})
