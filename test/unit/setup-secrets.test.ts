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

  it('warns on private IPs and internal hostnames', () => {
    const findings = scanForSecrets({ 'SKILL.md': enc('ssh root@192.168.2.50 and http://nas.local:8080 and 10.0.0.7\n') }, 'skills/x/')
    expect(findings.map(f => [f.path, f.severity, f.rule])).toEqual(expect.arrayContaining([
      ['skills/x/SKILL.md', 'warn', 'private-ip'],
      ['skills/x/SKILL.md', 'warn', 'internal-hostname']
    ]))
    expect(findings[0]!.line).toBe(1)
    expect(findings[0]!.excerpt.length).toBeLessThanOrEqual(80)
  })

  it('ignores prose mentions, placeholders and binary files', () => {
    expect(scanForSecrets({
      'README.md': enc('Store the password in the project skill, never here. Use {{pm}}.\nTOKEN=<your-token>\n'),
      'blob.bin': new Uint8Array([0x89, 0x50, 0x00, 0x41])
    })).toEqual([])
  })
})
