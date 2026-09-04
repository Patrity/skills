export interface SecretFinding {
  path: string
  line: number
  rule: string
  severity: 'fail' | 'warn'
  excerpt: string
}

const RULES: { rule: string, severity: 'fail' | 'warn', re: RegExp }[] = [
  { rule: 'api-key', severity: 'fail', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { rule: 'github-token', severity: 'fail', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { rule: 'aws-access-key', severity: 'fail', re: /\bAKIA[0-9A-Z]{16}/ },
  { rule: 'slack-token', severity: 'fail', re: /\bxox[abpr]-[A-Za-z0-9-]{10,}/ },
  { rule: 'private-key', severity: 'fail', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { rule: 'connection-string', severity: 'fail', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s/]+:[^@\s]+@/i },
  // The value class is "anything that is not whitespace, a quote or a backtick": a real password
  // is punctuated (`P@ssw0rd!2024`), and an alphanumeric-only class waved those through. Template
  // values survive because `<…>` and `{{…}}` are stripped from the line before the match.
  { rule: 'credential-assignment', severity: 'fail', re: /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"'`]{12,}/i },
  // Private ranges fail rather than warn: a bundle is installed into other people's projects, and
  // a homelab address in one is a leak of infrastructure the reader cannot reach anyway.
  { rule: 'private-ip', severity: 'fail', re: /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/ },
  // The leading lookbehind anchors the match at the start of a dotted token, so `.env.local`
  // and friends are not read as a hostname. Repeating the label group keeps multi-label
  // hosts (`box.nas.local`) covered.
  { rule: 'internal-hostname', severity: 'warn', re: /(?<![\w.-])(?:[a-z0-9-]+\.)+(?:local|lan|home|internal)\b(?!\.\w)/i }
]

const decoder = new TextDecoder()

function isBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.byteLength, 8000)
  for (let i = 0; i < end; i++) if (bytes[i] === 0) return true
  return false
}

/** Scan published text for secrets/private infrastructure. `pathPrefix` is prepended to reported paths. */
export function scanForSecrets(files: Record<string, Uint8Array>, pathPrefix = ''): SecretFinding[] {
  const findings: SecretFinding[] = []
  for (const [path, bytes] of Object.entries(files)) {
    if (bytes.byteLength > 1024 * 1024 || isBinary(bytes)) continue
    const lines = decoder.decode(bytes).split('\n')
    lines.forEach((line, i) => {
      // Placeholders like <your-token> or {{pm}} are documentation, not values.
      const stripped = line.replace(/<[^>]+>/g, '').replace(/\{\{[^}]+\}\}/g, '')
      for (const { rule, severity, re } of RULES) {
        if (re.test(stripped)) {
          findings.push({ path: pathPrefix + path, line: i + 1, rule, severity, excerpt: line.trim().slice(0, 80) })
        }
      }
    })
  }
  return findings
}
