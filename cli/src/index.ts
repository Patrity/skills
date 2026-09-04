import { defineCommand, runMain } from 'citty'
import init from './commands/init'
import { CLI_VERSION } from './version'

const main = defineCommand({
  meta: { name: 'skills', version: CLI_VERSION, description: 'Assemble a Claude Code setup from skills.patrity.com' },
  // init's args on the root so `skills --profile nuxt-app` parses like `skills init --profile nuxt-app`.
  args: init.args,
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

runMain(main)
