import { resolve } from 'node:path'
import { intro, outro } from '@clack/prompts'
import type { ArgsDef } from 'citty'
import { summarize } from '../prompts'
import type { RunResult } from '../run'
import { CLI_VERSION } from '../version'

/** Flags every command shares. `registry` has no default: `run.ts` resolves flag → lockfile → prod. */
export const commonArgs = {
  dir: { type: 'string', description: 'Project directory', default: '.' },
  registry: { type: 'string', description: 'Registry base URL (default: the lockfile\'s, else https://skills.patrity.com)' },
  yes: { type: 'boolean', description: 'Take the defaults and never prompt', default: false },
  force: { type: 'boolean', description: 'Overwrite files and CLAUDE.md blocks edited since install', default: false },
  json: { type: 'boolean', description: 'Print one JSON object on stdout and nothing else', default: false }
} as const satisfies ArgsDef

export interface CommonFlags {
  dir: string
  registry?: string
  yes: boolean
  force: boolean
  json: boolean
}

/** citty types a parsed flag as `string | number | boolean | string[]`; narrow it, don't trust it. */
export const strArg = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)

export function commonOpts(args: Record<string, unknown>): CommonFlags {
  return {
    dir: resolve(strArg(args.dir) ?? '.'),
    registry: strArg(args.registry),
    yes: args.yes === true,
    force: args.force === true,
    json: args.json === true
  }
}

/**
 * All values of a repeatable flag (`--answer pm=npm --answer layout=monorepo`, or comma-separated).
 * citty parses flags with `node:util`, which keeps only the last occurrence, so repeats are read
 * straight off the raw arguments.
 */
export function repeatedArg(rawArgs: string[], name: string): string[] {
  const values: string[] = []
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!
    if (arg === `--${name}`) {
      const next = rawArgs[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        values.push(next)
        i++
      }
    } else if (arg.startsWith(`--${name}=`)) {
      values.push(arg.slice(name.length + 3))
    }
  }
  return values.flatMap(v => v.split(',')).map(v => v.trim()).filter(Boolean)
}

/**
 * Move an explicit subcommand token to the front so `skills --dir X list` behaves like
 * `skills list --dir X`. citty dispatches with `rawArgs.slice(subCommandIndex + 1)`, so anything
 * written before the subcommand is parsed against the root command and then thrown away.
 *
 * `names` must include every subcommand alias; `valueFlags` every flag whose value is a separate
 * token (`--dir X` consumes `X`, `--dir=X` does not).
 */
export function hoistSubcommand(rawArgs: string[], names: string[], valueFlags: string[]): string[] {
  const known = new Set(names)
  const takesValue = new Set(valueFlags)
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!
    if (arg === '--') break
    if (arg.startsWith('-')) {
      if (!arg.includes('=') && takesValue.has(arg.replace(/^-+/, ''))) i++
      continue
    }
    // The first bare token is citty's subcommand slot: hoist it, or leave an unknown one for citty
    // to reject exactly as it would have.
    if (!known.has(arg) || i === 0) break
    return [arg, ...rawArgs.slice(0, i), ...rawArgs.slice(i + 1)]
  }
  return rawArgs
}

/** Positional operands (bundle slugs), whatever citty did not bind to a named flag. */
export function positionals(args: Record<string, unknown>): string[] {
  return Array.isArray(args._) ? args._.map(v => String(v).trim()).filter(Boolean) : []
}

export function startInteractive(opts: CommonFlags): void {
  if (!opts.json && !opts.yes) intro(`@patrity/skills ${CLI_VERSION}`)
}

/** Human-readable outcome for a command that built a plan; silent under `--json`. */
export function reportPlan(opts: CommonFlags, result: RunResult, done: string): void {
  if (opts.json) return
  if (!result.applied) {
    // Only reachable interactively, by declining the confirmation.
    outro('Nothing written.')
    return
  }
  if (opts.yes) {
    console.log(summarize(result.plan))
    return
  }
  outro(result.plan.warnings.length ? `${done} — ${result.plan.warnings.length} warning(s).` : done)
}

/** One clear line on stderr and exit 1 — never a dumped Error object or a stack trace. */
export async function guard(body: () => Promise<void>): Promise<void> {
  try {
    await body()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
