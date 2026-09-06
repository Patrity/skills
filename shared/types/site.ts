/** Types the site's own pages need, as opposed to the registry (`skills.ts`) or the setup (`setup.ts`). */

/**
 * One post from the lab notes feed (techhivelabs.net/rss.xml).
 *
 * `readMinutes` and `summary` are optional because a feed is free to omit `<description>`,
 * and because a `<description>` that is a one-line teaser rather than the post body cannot
 * honestly be turned into a read time; the card renders the date alone in that case.
 */
export interface LabPost {
  title: string
  url: string
  /** ISO 8601, parsed from `<pubDate>`. */
  date: string
  readMinutes?: number
  summary?: string
}

/** `GET /api/lab-feed`. `source` says whether the live feed answered or the frozen snapshot did. */
export interface LabFeedResponse {
  posts: LabPost[]
  source: 'live' | 'fallback'
}

/** One line of the frozen `init` transcript in `app/assets/transcripts/init.json`. */
export interface TranscriptLine {
  /** `cmd` types character by character; `out` and `ok` appear whole. */
  type: 'cmd' | 'out' | 'ok'
  text: string
  /** ms per character for `cmd`, ms for the whole line otherwise. */
  delay: number
  /** Drawn in the dimmed colour: the ".. 18 more" elision, not a real path. */
  dim?: boolean
}

export interface Transcript {
  lines: TranscriptLine[]
}
