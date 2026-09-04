import { defineCommand, runMain } from 'citty'
import { CLI_VERSION } from './version'

const main = defineCommand({
  meta: { name: 'skills', version: CLI_VERSION, description: 'Assemble a Claude Code setup from skills.patrity.com' },
  run() {
    console.log(`@patrity/skills ${CLI_VERSION} — commands arrive in a later task`)
  }
})

runMain(main)
