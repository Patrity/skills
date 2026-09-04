import { defineCommand } from 'citty'
import { runDiff, type DiffReport } from '../run'
import { commonArgs, commonOpts, guard } from './common'

const short = (sha: string): string => (sha.length > 7 ? sha.slice(0, 7) : sha)

function render(report: DiffReport): string {
  const lines: string[] = []
  const list = (label: string, paths: string[]) => {
    if (paths.length) lines.push(`${label} (${paths.length}):`, ...paths.map(p => `  ${p}`))
  }
  list('modified since install', report.modified)
  list('missing', report.missing)
  if (report.handEdited.length) lines.push(`hand-edited CLAUDE.md blocks: ${report.handEdited.join(', ')}`)
  for (const u of report.upstream) lines.push(`${u.slug}: installed ${short(u.installed)}, registry ${short(u.latest)}`)
  return lines.length ? lines.join('\n') : 'Everything matches the lockfile.'
}

export default defineCommand({
  meta: { name: 'diff', description: 'Show what changed since install, locally and upstream' },
  args: { ...commonArgs },
  run: ({ args }) => guard(async () => {
    const opts = commonOpts(args)
    const report = await runDiff(opts)
    if (!opts.json) console.log(render(report))
  })
})
