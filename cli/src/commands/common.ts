import { resolve } from 'node:path'
import { intro, outro } from '@clack/prompts'
import type { ArgsDef } from 'citty'
import type { SetupPlan } from '../plan'
import { summarize } from '../prompts'
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

/** Positional operands (bundle slugs), whatever citty did not bind to a named flag. */
export function positionals(args: Record<string, unknown>): string[] {
  return Array.isArray(args._) ? args._.map(v => String(v).trim()).filter(Boolean) : []
}

export function startInteractive(opts: CommonFlags): void {
  if (!opts.json && !opts.yes) intro(`@patrity/skills ${CLI_VERSION}`)
}

/** Human-readable outcome for a command that applied a plan; silent under `--json`. */
export function reportPlan(opts: CommonFlags, plan: SetupPlan, done: string): void {
  if (opts.json) return
  if (opts.yes) {
    console.log(summarize(plan))
    return
  }
  outro(plan.warnings.length ? `${done} — ${plan.warnings.length} warning(s).` : done)
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
