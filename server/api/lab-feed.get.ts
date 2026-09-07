import type { LabFeedResponse, LabPost } from '~~/shared/types/site'
import { LINKS } from '~~/shared/utils/links'
import { latestLabPosts } from '~~/server/lib/site/lab-feed'
import fallback from '~~/content/lab-feed.fallback.json'

/**
 * The two newest lab notes, for the home page's "From the lab" section.
 *
 * Server-side only, on purpose: the browser never talks to techhivelabs.net, so no visitor
 * pays for that round trip and no third-party origin sees them.
 *
 * The `isr: 3600` route rule (nuxt.config, tagged `skills`) only covers the URL a client
 * navigation fetches. The home page's `useFetch('/api/lab-feed')` calls this handler
 * directly during SSR, so every regeneration of the home page hits the feed again. What
 * bounds that is not the cache: it is the 5 s timeout and the fallback below, which are
 * also what keeps a slow or broken feed from taking the home page down. Every failure
 * lands on the snapshot in content/lab-feed.fallback.json.
 */
const TIMEOUT_MS = 5_000

export default defineEventHandler(async (): Promise<LabFeedResponse> => {
  const snapshot = fallback as LabPost[]
  // Wrapped rather than passed by reference: an unbound `fetch` throws "Illegal invocation"
  // on some runtimes.
  const posts = await latestLabPosts((input, init) => fetch(input, init), { url: LINKS.rss, timeoutMs: TIMEOUT_MS, fallback: snapshot })
  // `latestLabPosts` returns the very array it was handed when it gives up, so identity is
  // what separates a fallback from a live answer that happens to match the snapshot.
  return { posts, source: posts === snapshot ? 'fallback' : 'live' }
})
