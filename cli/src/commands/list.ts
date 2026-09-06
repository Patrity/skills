import { defineCommand } from 'citty'
import { runList, type ListReport } from '../run'
import { commonArgs, commonOpts, guard } from './common'

const short = (sha: string): string => (sha.length > 7 ? sha.slice(0, 7) : sha)

function render(report: ListReport): string {
  const answers = Object.entries(report.answers).map(([k, v]) => `${k}=${v}`).join(' ')
  const drift = report.installedSha && report.installedSha !== report.upstreamSha ? ' (out of date; run `skills update`)' : ''
  return [
    `registry  ${report.registry}`,
    `snapshot  ${short(report.installedSha) || 'none'} · registry ${short(report.upstreamSha) || 'none'}${drift}`,
    `answers   ${answers || 'none'}`,
    `bundles   ${report.bundles.join(', ') || 'none'}`
  ].join('\n')
}

export default defineCommand({
  meta: { name: 'list', alias: ['ls'], description: 'Show what is installed and the answers on record' },
  args: { ...commonArgs },
  run: ({ args }) => guard(async () => {
    const opts = commonOpts(args)
    const report = await runList(opts)
    if (!opts.json) console.log(render(report))
  })
})
