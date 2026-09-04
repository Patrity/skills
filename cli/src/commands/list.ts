import { defineCommand } from 'citty'
import { runList, type ListReport } from '../run'
import { commonArgs, commonOpts, guard } from './common'

const short = (sha: string): string => (sha.length > 7 ? sha.slice(0, 7) : sha)

function render(report: ListReport): string {
  const answers = Object.entries(report.answers).map(([k, v]) => `${k}=${v}`).join(' ')
  const drift = report.installedSha && report.installedSha !== report.upstreamSha ? ' (out of date — run `skills update`)' : ''
  return [
    `registry  ${report.registry}`,
    `snapshot  ${short(report.installedSha) || '—'} · registry ${short(report.upstreamSha) || '—'}${drift}`,
    `answers   ${answers || '—'}`,
    `bundles   ${report.bundles.join(', ') || '—'}`
  ].join('\n')
}

export default defineCommand({
  meta: { name: 'list', alias: ['ls'], description: 'Show the installed bundles and the recorded answers' },
  args: { ...commonArgs },
  run: ({ args }) => guard(async () => {
    const opts = commonOpts(args)
    const report = await runList(opts)
    if (!opts.json) console.log(render(report))
  })
})
