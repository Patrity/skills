import { describe, expect, it } from 'vitest'
import { scanForSecrets } from '../../server/lib/setup/secrets'

const enc = (s: string) => new TextEncoder().encode(s)

describe('scanForSecrets', () => {
  it('fails on token-like values and connection strings', () => {
    const findings = scanForSecrets({
      'skills/a/SKILL.md': enc('key: sk-abcdefghijklmnopqrstuvwxyz1234\n'),
      'settings.json': enc('{"token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"}'),
      'rules/db.md': enc('DATABASE_URL=postgres://user:hunter2hunter2@db.example.com/x\n'),
      'README.md': enc('password: correct-horse-battery\n')
    })
    expect(findings.map(f => [f.path, f.severity, f.rule])).toEqual(expect.arrayContaining([
      ['skills/a/SKILL.md', 'fail', 'api-key'],
      ['settings.json', 'fail', 'github-token'],
      ['rules/db.md', 'fail', 'connection-string'],
      ['README.md', 'fail', 'credential-assignment']
    ]))
  })

  it('fails on a punctuated password an alphanumeric value class missed', () => {
    const findings = scanForSecrets({ 'README.md': enc('password: P@ssw0rd!2024\n') })
    expect(findings.map(f => [f.severity, f.rule])).toEqual([['fail', 'credential-assignment']])
  })

  it('fails on cloud provider keys and private key blocks', () => {
    const findings = scanForSecrets({
      'a.md': enc('AWS_ACCESS_KEY_ID AKIAIOSFODNN7EXAMPLE\n'),
      'b.md': enc('slack bot: xoxb-1234567890-ABCdefGHIjkl\n'),
      'c.pem': enc('-----BEGIN OPENSSH PRIVATE KEY-----\nbase64\n'),
      'd.pem': enc('-----BEGIN PRIVATE KEY-----\n')
    })
    expect(findings.map(f => [f.path, f.severity, f.rule])).toEqual([
      ['a.md', 'fail', 'aws-access-key'],
      ['b.md', 'fail', 'slack-token'],
      ['c.pem', 'fail', 'private-key'],
      ['d.pem', 'fail', 'private-key']
    ])
  })

  it('fails on private IPs and warns on internal hostnames', () => {
    const findings = scanForSecrets({ 'SKILL.md': enc('ssh root@192.168.2.50 and http://nas.local:8080 and 10.0.0.7\n') }, 'skills/x/')
    expect(findings.map(f => [f.path, f.severity, f.rule])).toEqual(expect.arrayContaining([
      ['skills/x/SKILL.md', 'fail', 'private-ip'],
      ['skills/x/SKILL.md', 'warn', 'internal-hostname']
    ]))
    expect(findings[0]!.line).toBe(1)
    expect(findings[0]!.excerpt.length).toBeLessThanOrEqual(80)
  })

  it('does not flag a filename that merely contains an internal TLD label', () => {
    const findings = scanForSecrets({ 'x.md': enc('settings.local.json\nnas.local\n') })
    expect(findings.map(f => [f.line, f.rule])).toEqual([[2, 'internal-hostname']])
  })

  it('does not read a dotfile suffix as an internal hostname', () => {
    const findings = scanForSecrets({
      'hooks/protect-env.sh': enc('  .env|.env.local|.env.production|credentials.json|secrets.*)\n'),
      'CLAUDE.md': enc('Edits to `.env.local` are refused.\n')
    })
    expect(findings).toEqual([])
  })

  it('still warns on a real internal hostname, bare or in a URL', () => {
    const findings = scanForSecrets({
      'a.md': enc('nas.local\n'),
      'b.md': enc('http://nas.local:8080\n'),
      'c.md': enc('box.nas.local\n')
    })
    expect(findings.map(f => [f.path, f.rule])).toEqual([
      ['a.md', 'internal-hostname'],
      ['b.md', 'internal-hostname'],
      ['c.md', 'internal-hostname']
    ])
  })

  it('ignores prose mentions, placeholders and binary files', () => {
    expect(scanForSecrets({
      'README.md': enc('Store the password in the project skill, never here. Use {{pm}}.\nTOKEN=<your-token>\n'),
      'blob.bin': new Uint8Array([0x89, 0x50, 0x00, 0x41])
    })).toEqual([])
  })

  it('lets templated credential values through, however punctuated', () => {
    expect(scanForSecrets({
      'SKILL.md': enc([
        'ALTER ROLE app_claude_ro PASSWORD \'<value>\';',
        'password: <the-one-in-your-secret-manager>',
        'api_key = {{apiKey}}',
        'token: <token-from-the-provider-console>'
      ].join('\n'))
    })).toEqual([])
  })
})
