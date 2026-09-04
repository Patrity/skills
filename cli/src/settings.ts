export type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const unionStrings = (a: unknown, b: unknown): string[] => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter((x): x is string => typeof x === 'string'))]

function mergeHookEvent(existing: unknown, incoming: unknown): unknown[] {
  type Group = { matcher?: string, hooks?: unknown[] }
  const groups: Group[] = Array.isArray(existing) ? existing.map(g => ({ ...(g as Group), hooks: [...((g as Group).hooks ?? [])] })) : []
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const g = raw as Group
    const target = groups.find(x => (x.matcher ?? '') === (g.matcher ?? ''))
    if (!target) {
      groups.push({ ...g, hooks: [...(g.hooks ?? [])] })
      continue
    }
    const seen = new Set((target.hooks ?? []).map(h => JSON.stringify(h)))
    for (const h of g.hooks ?? []) {
      if (seen.has(JSON.stringify(h))) continue
      target.hooks!.push(h)
      seen.add(JSON.stringify(h))
    }
  }
  return groups
}

export function mergeSettings(existing: Json | null, incoming: Json): Json {
  const out: Json = { ...(existing ?? {}) }
  for (const [key, value] of Object.entries(incoming)) {
    const current = out[key]
    if (key === 'hooks' && isObject(value)) {
      const hooks: Json = { ...(isObject(current) ? current : {}) }
      for (const [event, groups] of Object.entries(value)) hooks[event] = mergeHookEvent(hooks[event], groups)
      out.hooks = hooks
    } else if (key === 'permissions' && isObject(value)) {
      const perms: Json = { ...(isObject(current) ? current : {}) }
      if ('allow' in value) perms.allow = unionStrings(perms.allow, value.allow)
      if ('deny' in value) perms.deny = unionStrings(perms.deny, value.deny)
      for (const [k, v] of Object.entries(value)) if (k !== 'allow' && k !== 'deny') perms[k] = v
      out.permissions = perms
    } else if (key === 'enabledPlugins' && isObject(value)) {
      out.enabledPlugins = { ...(isObject(current) ? current : {}), ...value }
    } else if (isObject(value) && isObject(current)) {
      out[key] = mergeSettings(current, value)
    } else {
      out[key] = value
    }
  }
  return out
}

export function splitBundleSettings(settings: Json | null, settingsLocal: Json | null): { shared: Json, local: Json } {
  const shared: Json = { ...(settings ?? {}) }
  let local: Json = {}
  if (isObject(shared.permissions) && 'allow' in shared.permissions) {
    const { allow, ...rest } = shared.permissions
    local = mergeSettings(local, { permissions: { allow } })
    if (Object.keys(rest).length) shared.permissions = rest
    else delete shared.permissions
  }
  if (settingsLocal) local = mergeSettings(local, settingsLocal)
  return { shared, local }
}

export function ensureGitignoreLine(gitignore: string | null, line: string): string {
  const lines = (gitignore ?? '').split('\n')
  if (lines.some(l => l.trim() === line)) return gitignore!
  const base = gitignore ? (gitignore.endsWith('\n') ? gitignore : `${gitignore}\n`) : ''
  return `${base}${line}\n`
}

export function formatJson(value: Json): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
