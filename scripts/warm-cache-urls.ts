import { readFileSync } from 'node:fs'
import { buildWarmUrls } from '../server/lib/skills/warm-urls'
import type { SkillDetailResponse } from '../shared/types/skills'

// usage: tsx scripts/warm-cache-urls.ts <sitemap.xml> <build-id> <skill-detail.json>...
//
// <build-id> is `.id` from /_nuxt/builds/latest.json, or '' when it could not be read; it
// becomes the ?_b= on every payload URL. Prints one site-relative URL per line;
// scripts/warm-cache.sh prefixes the site origin.
const [sitemapPath, buildId, ...detailPaths] = process.argv.slice(2)

if (!sitemapPath || buildId === undefined) {
  console.error('usage: warm-cache-urls.ts <sitemap.xml> <build-id> <skill-detail.json>...')
  process.exit(2)
}

const sitemap = readFileSync(sitemapPath, 'utf8')
const details = detailPaths.map(p => JSON.parse(readFileSync(p, 'utf8')) as SkillDetailResponse)

console.log(buildWarmUrls(sitemap, details, buildId || undefined).join('\n'))
