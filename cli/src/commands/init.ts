import { defineCommand, type ArgsDef } from 'citty'
import { runInit } from '../run'
import { commonArgs, commonOpts, guard, repeatedArg, reportPlan, startInteractive, strArg } from './common'

/** Also the root command's args, so `skills --profile x` parses like `skills init --profile x`. */
export const initArgs = {
  ...commonArgs,
  profile: { type: 'string', description: 'Start from a registry profile (e.g. nuxt-app)' },
  with: { type: 'string', description: 'Bundle slugs to include (repeatable, comma-separated)' },
  answer: { type: 'string', description: 'axis=option (repeatable, comma-separated)' }
} as const satisfies ArgsDef

export default defineCommand({
  meta: { name: 'init', description: 'Assemble a Claude Code setup in this project' },
  args: initArgs,
  run: ({ args, rawArgs }) => guard(async () => {
    const opts = commonOpts(args)
    startInteractive(opts)
    const result = await runInit({
      ...opts,
      profile: strArg(args.profile),
      with: repeatedArg(rawArgs, 'with'),
      answers: repeatedArg(rawArgs, 'answer')
    })
    reportPlan(opts, result, 'Setup written.')
  })
})
