import { readFileSync } from 'node:fs'
import { buildWarmUrls } from '../server/lib/skills/warm-urls'
import type { SkillDetailResponse } from '../shared/types/skills'

// usage: tsx scripts/warm-cache-urls.ts <sitemap.xml> <skill-detail.json>...
// Prints one site-relative URL per line; scripts/warm-cache.sh prefixes the site origin.
const [sitemapPath, ...detailPaths] = process.argv.slice(2)

if (!sitemapPath) {
  console.error('usage: warm-cache-urls.ts <sitemap.xml> <skill-detail.json>...')
  process.exit(2)
}

const sitemap = readFileSync(sitemapPath, 'utf8')
const details = detailPaths.map(p => JSON.parse(readFileSync(p, 'utf8')) as SkillDetailResponse)

console.log(buildWarmUrls(sitemap, details).join('\n'))
