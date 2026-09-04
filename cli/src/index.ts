import { defineCommand, runMain } from 'citty'
import { initArgs } from './commands/init'
import { hoistSubcommand } from './commands/common'
import { CLI_VERSION } from './version'

/** Every subcommand name and alias — keep in step with each command's `meta`. */
const SUBCOMMANDS = ['init', 'add', 'remove', 'rm', 'update', 'up', 'diff', 'list', 'ls']
/** Flags whose value is a separate token, so hoisting does not mistake the value for a command. */
const VALUE_FLAGS = Object.entries(initArgs).filter(([, def]) => def.type === 'string').map(([name]) => name)

const main = defineCommand({
  meta: { name: 'skills', version: CLI_VERSION, description: 'Assemble a Claude Code setup from skills.patrity.com' },
  // init's args on the root so `skills --profile nuxt-app` parses like `skills init --profile nuxt-app`.
  args: initArgs,
  subCommands: {
    init: () => import('./commands/init').then(m => m.default),
    add: () => import('./commands/add').then(m => m.default),
    remove: () => import('./commands/remove').then(m => m.default),
    update: () => import('./commands/update').then(m => m.default),
    diff: () => import('./commands/diff').then(m => m.default),
    list: () => import('./commands/list').then(m => m.default)
  },
  // Bare `skills` runs the wizard. `default` (not `run`) — citty runs a command's own `run` even
  // after dispatching to a subcommand, which would run init a second time.
  default: 'init'
})

// citty only passes what follows the subcommand token down to it, so flags written before it would
// be parsed against the root and dropped. Hoisting the token first makes both orders equivalent.
runMain(main, { rawArgs: hoistSubcommand(process.argv.slice(2), SUBCOMMANDS, VALUE_FLAGS) })
