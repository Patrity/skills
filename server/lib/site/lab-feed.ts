import type { LabPost } from '../../../shared/types/site'

/**
 * The lab notes feed, parsed without a dependency.
 *
 * Relative imports only: vitest and tsx load this file without Nuxt, so `~~/` aliases
 * would not resolve (same rule as server/lib/skills/).
 *
 * A regex parser is the right size here. The feed is one file we control, RSS 2.0, and the
 * only fields the two home-page cards need are title, link, pubDate and description. An XML
 * parser would be a new dependency for four `<item>` children, and every failure mode below
 * lands on the frozen fallback anyway.
 */

/** Words per minute. 220 is the usual desktop-reading estimate. */
const WORDS_PER_MINUTE = 220

/** How many posts the "From the lab" section shows. */
const POST_COUNT = 2

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': '\'',
  '&apos;': '\''
}

/** `&amp;` last would double-decode `&amp;lt;`, so all five are replaced in one pass. */
function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, m => ENTITIES[m] ?? m)
}

/** Pull one child element out of an `<item>`, unwrapping CDATA and decoding entities. */
function field(item: string, name: string): string {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(item)
  return match ? decodeEntities(match[1]!.trim()) : ''
}

/**
 * Minutes to read `text`, or undefined when it is plainly a teaser rather than the body.
 *
 * Rounding is what draws that line: under about 110 words the estimate rounds to zero, and
 * a card would rather show no read time than claim "1 min read" for a two-sentence summary.
 */
function readMinutes(text: string): number | undefined {
  const words = text.split(/\s+/).filter(Boolean).length
  const minutes = Math.round(words / WORDS_PER_MINUTE)
  return minutes > 0 ? minutes : undefined
}

/**
 * Every `<item>` in an RSS document, newest first.
 *
 * Items with no link or an unparseable date are dropped: they would render as a card that
 * goes nowhere or is dated "Invalid Date".
 */
export function parseRss(xml: string): LabPost[] {
  const posts: LabPost[] = []
  for (const [, item] of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)) {
    const url = field(item!, 'link')
    const time = Date.parse(field(item!, 'pubDate'))
    if (!url || Number.isNaN(time)) continue

    const summary = field(item!, 'description')
    const post: LabPost = { title: field(item!, 'title'), url, date: new Date(time).toISOString() }
    const minutes = summary ? readMinutes(summary) : undefined
    if (minutes !== undefined) post.readMinutes = minutes
    if (summary) post.summary = summary
    posts.push(post)
  }
  return posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export interface LabFeedOptions {
  url: string
  timeoutMs: number
  /** Returned as-is whenever the live feed cannot be turned into posts. */
  fallback: LabPost[]
}

/**
 * The two newest posts from the live feed, or `fallback`.
 *
 * `fetchImpl` is injected so the tests can fail, hang or answer without a network. The home
 * page must never be held up by someone else's server, so anything that is not two parsed
 * posts inside the budget is logged and swallowed: the section renders the snapshot instead
 * of disappearing or 500-ing the page.
 */
export async function latestLabPosts(fetchImpl: typeof fetch, opts: LabFeedOptions): Promise<LabPost[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    const res = await fetchImpl(opts.url, { signal: controller.signal, headers: { accept: 'application/rss+xml, application/xml, text/xml' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const posts = parseRss(await res.text())
    if (!posts.length) throw new Error('no <item> elements')
    return posts.slice(0, POST_COUNT)
  } catch (error) {
    console.warn(`[lab-feed] falling back: ${error instanceof Error ? error.message : String(error)}`)
    return opts.fallback
  } finally {
    clearTimeout(timer)
  }
}
