import { defineCommand } from 'citty'
import { runRemove } from '../run'
import { commonArgs, commonOpts, guard, positionals, reportPlan, startInteractive } from './common'

export default defineCommand({
  meta: { name: 'remove', alias: ['rm'], description: 'Remove bundles and the files they installed' },
  args: {
    ...commonArgs,
    slugs: { type: 'positional', required: false, valueHint: 'slug...', description: 'Bundle slugs to remove' }
  },
  run: ({ args }) => guard(async () => {
    const opts = commonOpts(args)
    const slugs = positionals(args)
    if (!slugs.length) throw new Error('remove what? pass one or more bundle slugs, e.g. `skills remove nuxt-ui`')
    startInteractive(opts)
    reportPlan(opts, await runRemove({ ...opts, slugs }), `Removed ${slugs.join(', ')}.`)
  })
})
