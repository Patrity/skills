export type Json = Record<string, unknown>

/**
 * What one bundle put into the two settings files, recorded in the lockfile so a later run can take
 * it back out: hook identities per event, and the permission/plugin entries it contributed.
 */
export interface SettingsContribution {
  hooks: Record<string, string[]>
  allow: string[]
  deny: string[]
  enabledPlugins: string[]
}

type HookGroup = { matcher?: string, hooks?: unknown[] }

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const unionStrings = (a: unknown, b: unknown): string[] => [...new Set([...strings(a), ...strings(b)])]

/**
 * A hook's identity for merge and subtraction: matcher, type and command (spec §5.2 unions by
 * command). Deliberately not the whole object — when upstream changes a `timeout`, the entry must
 * replace the installed one rather than sit beside it as a duplicate.
 */
export function hookIdentity(matcher: string | undefined, hook: unknown): string {
  const h = (isObject(hook) ? hook : {}) as { type?: unknown, command?: unknown, prompt?: unknown }
  const body = typeof h.command === 'string' ? h.command : typeof h.prompt === 'string' ? h.prompt : ''
  return JSON.stringify([matcher ?? '', typeof h.type === 'string' ? h.type : '', body])
}

function mergeHookEvent(existing: unknown, incoming: unknown): unknown[] {
  const groups: HookGroup[] = Array.isArray(existing) ? existing.map(g => ({ ...(g as HookGroup), hooks: [...((g as HookGroup).hooks ?? [])] })) : []
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const g = raw as HookGroup
    const target = groups.find(x => (x.matcher ?? '') === (g.matcher ?? ''))
    if (!target) {
      groups.push({ ...g, hooks: [...(g.hooks ?? [])] })
      continue
    }
    for (const hook of g.hooks ?? []) {
      const id = hookIdentity(target.matcher, hook)
      const at = (target.hooks ?? []).findIndex(h => hookIdentity(target.matcher, h) === id)
      if (at === -1) target.hooks!.push(hook)
      else target.hooks![at] = hook // same command, changed timeout: replace, never duplicate
    }
  }
  return groups
}

/** Everything the given settings objects (a bundle's shared + local halves) contribute, deduped. */
export function settingsContribution(...parts: (Json | null)[]): SettingsContribution {
  const hooks: Record<string, Set<string>> = {}
  const allow = new Set<string>()
  const deny = new Set<string>()
  const plugins = new Set<string>()
  for (const part of parts) {
    if (!part) continue
    if (isObject(part.hooks)) {
      for (const [event, groups] of Object.entries(part.hooks)) {
        for (const raw of Array.isArray(groups) ? groups : []) {
          const g = raw as HookGroup
          for (const hook of g.hooks ?? []) (hooks[event] ??= new Set()).add(hookIdentity(g.matcher, hook))
        }
      }
    }
    if (isObject(part.permissions)) {
      for (const entry of strings(part.permissions.allow)) allow.add(entry)
      for (const entry of strings(part.permissions.deny)) deny.add(entry)
    }
    if (isObject(part.enabledPlugins)) for (const key of Object.keys(part.enabledPlugins)) plugins.add(key)
  }
  return {
    hooks: Object.fromEntries(Object.entries(hooks).map(([event, ids]) => [event, [...ids]])),
    allow: [...allow],
    deny: [...deny],
    enabledPlugins: [...plugins]
  }
}

export const isEmptyContribution = (c: SettingsContribution): boolean =>
  !Object.keys(c.hooks).length && !c.allow.length && !c.deny.length && !c.enabledPlugins.length

/**
 * Take one bundle's recorded contribution back out of a settings file. Hooks go by identity, so an
 * entry the user retyped by hand survives; empty matcher groups, events and containers are pruned.
 * Anything another selected bundle still contributes is merged straight back in afterwards.
 */
export function subtractSettings(existing: Json | null, contribution: SettingsContribution): Json {
  const out: Json = { ...(existing ?? {}) }
  if (isObject(out.hooks)) {
    const hooks: Json = {}
    for (const [event, groups] of Object.entries(out.hooks)) {
      const drop = new Set(contribution.hooks[event] ?? [])
      const kept: HookGroup[] = []
      for (const raw of Array.isArray(groups) ? groups : []) {
        const g = raw as HookGroup
        const remaining = (g.hooks ?? []).filter(h => !drop.has(hookIdentity(g.matcher, h)))
        if (remaining.length) kept.push({ ...g, hooks: remaining })
      }
      if (kept.length) hooks[event] = kept
    }
    if (Object.keys(hooks).length) out.hooks = hooks
    else delete out.hooks
  }
  if (isObject(out.permissions)) {
    const perms: Json = { ...out.permissions }
    for (const [key, dropped] of [['allow', contribution.allow], ['deny', contribution.deny]] as const) {
      if (!Array.isArray(perms[key])) continue
      const kept = (perms[key] as unknown[]).filter(v => typeof v !== 'string' || !dropped.includes(v))
      if (kept.length) perms[key] = kept
      // `Reflect.deleteProperty` and not `delete perms[key]`: the site lint bans a computed delete.
      else Reflect.deleteProperty(perms, key)
    }
    if (Object.keys(perms).length) out.permissions = perms
    else delete out.permissions
  }
  if (isObject(out.enabledPlugins)) {
    const plugins: Json = { ...out.enabledPlugins }
    for (const key of contribution.enabledPlugins) Reflect.deleteProperty(plugins, key)
    if (Object.keys(plugins).length) out.enabledPlugins = plugins
    else delete out.enabledPlugins
  }
  return out
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

export function formatJson(value: Json): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
