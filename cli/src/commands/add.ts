import { defineCommand } from 'citty'
import { runAdd } from '../run'
import { commonArgs, commonOpts, guard, positionals, reportPlan, startInteractive } from './common'

export default defineCommand({
  meta: { name: 'add', description: 'Add bundles to an existing setup' },
  args: {
    ...commonArgs,
    slugs: { type: 'positional', required: false, valueHint: 'slug...', description: 'Bundle slugs to add' }
  },
  run: ({ args }) => guard(async () => {
    const opts = commonOpts(args)
    const slugs = positionals(args)
    if (!slugs.length) throw new Error('add what? pass one or more bundle slugs, e.g. `skills add nuxt-ui`')
    startInteractive(opts)
    reportPlan(opts, await runAdd({ ...opts, slugs }), `Added ${slugs.join(', ')}.`)
  })
})
