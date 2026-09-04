import { defineCommand } from 'citty'
import { runUpdate } from '../run'
import { commonArgs, commonOpts, guard, positionals, reportPlan, startInteractive } from './common'

export default defineCommand({
  meta: { name: 'update', alias: ['up'], description: 'Re-render the setup from the current registry' },
  args: {
    ...commonArgs,
    slugs: { type: 'positional', required: false, valueHint: 'slug...', description: 'Bundles to check (default: all installed)' }
  },
  run: ({ args }) => guard(async () => {
    const opts = commonOpts(args)
    const slugs = positionals(args)
    startInteractive(opts)
    const result = await runUpdate({ ...opts, slugs })
    // "Up to date." only when the re-render actually touched nothing: the lockfile is rewritten
    // every run, so it is the written/removed files that say whether anything changed.
    const wrote = Boolean(result.result && (result.result.written.length || result.result.removed.length))
    reportPlan(opts, result, wrote ? (slugs.length ? `Updated ${slugs.join(', ')}.` : 'Updated.') : 'Up to date.')
  })
})
