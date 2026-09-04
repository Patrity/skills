export * from '../../shared/setup/wizard'

/** CLI-only: `--answer axis=option` flags, which only the terminal wizard collects. */
export function parseAnswerFlags(flags: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const flag of flags) {
    const m = /^([A-Za-z][A-Za-z0-9]*)=(.*)$/.exec(flag)
    if (!m) throw new Error(`--answer "${flag}": expected axis=option`)
    out[m[1]!] = m[2]!
  }
  return out
}
