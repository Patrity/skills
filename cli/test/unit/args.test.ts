import { describe, expect, it } from 'vitest'
import { commonOpts, hoistSubcommand, positionals, repeatedArg } from '../../src/commands/common'
import { initArgs } from '../../src/commands/init'

const NAMES = ['init', 'add', 'remove', 'rm', 'update', 'up', 'diff', 'list', 'ls']
const VALUES = Object.entries(initArgs).filter(([, def]) => def.type === 'string').map(([name]) => name)
const hoist = (...raw: string[]) => hoistSubcommand(raw, NAMES, VALUES)

describe('hoistSubcommand', () => {
  it('moves a subcommand written after shared flags to the front', () => {
    // citty dispatches with everything *after* the subcommand, so `--dir X` would be dropped.
    expect(hoist('--dir', 'X', 'list')).toEqual(['list', '--dir', 'X'])
    expect(hoist('--registry=http://x', '--yes', 'diff')).toEqual(['diff', '--registry=http://x', '--yes'])
    expect(hoist('--yes', 'init', '--profile', 'demo')).toEqual(['init', '--yes', '--profile', 'demo'])
  })

  it('leaves an already-leading subcommand and a bare invocation alone', () => {
    expect(hoist('list', '--dir', 'X')).toEqual(['list', '--dir', 'X'])
    expect(hoist('--yes')).toEqual(['--yes'])
    expect(hoist()).toEqual([])
  })

  it('handles aliases and operands', () => {
    expect(hoist('--dir', 'X', 'rm', 'demo')).toEqual(['rm', '--dir', 'X', 'demo'])
    expect(hoist('--force', 'up')).toEqual(['up', '--force'])
  })

  it('never treats a flag value or an unknown token as a subcommand', () => {
    // `list` here is the value of --profile, not a command.
    expect(hoist('--profile', 'list', '--yes')).toEqual(['--profile', 'list', '--yes'])
    expect(hoist('--dir', 'list')).toEqual(['--dir', 'list'])
    // An unknown first operand stays put so citty reports "Unknown command".
    expect(hoist('ghost', 'list')).toEqual(['ghost', 'list'])
    expect(hoist('--', 'list')).toEqual(['--', 'list'])
  })
})

describe('repeatedArg', () => {
  it('collects every occurrence and splits comma lists', () => {
    expect(repeatedArg(['--answer', 'pm=npm', '--answer', 'layout=monorepo'], 'answer')).toEqual(['pm=npm', 'layout=monorepo'])
    expect(repeatedArg(['--with=a,b', '--with', 'c'], 'with')).toEqual(['a', 'b', 'c'])
    expect(repeatedArg(['--with', '--yes'], 'with')).toEqual([])
    expect(repeatedArg(['--dir', 'x'], 'with')).toEqual([])
  })
})

describe('commonOpts', () => {
  it('resolves dir, drops an empty registry and coerces the booleans', () => {
    const opts = commonOpts({ dir: '.', registry: '', yes: true, force: false, json: 'nope' })
    expect(opts.dir).toBe(process.cwd())
    expect(opts.registry).toBeUndefined()
    expect(opts).toMatchObject({ yes: true, force: false, json: false })
  })

  it('reads positional operands', () => {
    expect(positionals({ _: ['a', ' b ', ''] })).toEqual(['a', 'b'])
    expect(positionals({})).toEqual([])
  })
})
