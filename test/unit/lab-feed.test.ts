import { describe, expect, it } from 'vitest'
import { latestLabPosts, parseRss } from '../../server/lib/site/lab-feed'

const xml = `<?xml version="1.0"?><rss><channel>
<item><title>Older post</title><link>https://www.techhivelabs.net/blog/older</link><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate><description>${'word '.repeat(440)}</description></item>
<item><title>Newest &amp; best</title><link>https://www.techhivelabs.net/blog/newest</link><pubDate>Wed, 19 Aug 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`

describe('lab feed', () => {
  it('parses items, decodes entities, sorts newest first, estimates read time', () => {
    const posts = parseRss(xml)
    expect(posts.map(p => p.title)).toEqual(['Newest & best', 'Older post'])
    expect(posts[1]).toMatchObject({ url: 'https://www.techhivelabs.net/blog/older', date: '2026-06-01T10:00:00.000Z', readMinutes: 2 })
  })
  it('falls back on network failure and on timeout', async () => {
    const fallback = [{ title: 'f', url: 'https://www.techhivelabs.net/blog/f', date: '2026-01-01T00:00:00.000Z' }]
    const failing = (async () => {
      throw new Error('boom')
    }) as unknown as typeof fetch
    expect(await latestLabPosts(failing, { url: 'x', timeoutMs: 5000, fallback })).toEqual(fallback)
    const slow = ((_: string, init?: RequestInit) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch
    expect(await latestLabPosts(slow, { url: 'x', timeoutMs: 10, fallback })).toEqual(fallback)
  })
})

// The cases the brief's two do not reach: the happy path, CDATA titles, the summary the
// cards render, and the shapes that must not blow up the home page.
describe('lab feed, beyond the contract', () => {
  const ok = (body: string) => (async () => new Response(body, { status: 200 })) as unknown as typeof fetch

  it('returns the two newest posts on a live fetch', async () => {
    const posts = await latestLabPosts(ok(xml), { url: 'x', timeoutMs: 5000, fallback: [] })
    expect(posts.map(p => p.title)).toEqual(['Newest & best', 'Older post'])
  })

  it('keeps only the two newest when the feed carries more', async () => {
    const many = `<rss><channel>${[1, 2, 3, 4].map(n => `<item><title>Post ${n}</title><link>https://www.techhivelabs.net/blog/p${n}</link><pubDate>0${n} Jan 2026 00:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`
    expect(parseRss(many).length).toBe(4)
    const posts = await latestLabPosts(ok(many), { url: 'x', timeoutMs: 5000, fallback: [] })
    expect(posts.map(p => p.title)).toEqual(['Post 4', 'Post 3'])
  })

  it('unwraps CDATA and carries the description as the card summary', () => {
    const cdata = `<rss><channel><item><title><![CDATA[Bots & swords]]></title><link><![CDATA[https://www.techhivelabs.net/blog/bots]]></link><pubDate>Sat, 25 Jul 2026 00:00:00 GMT</pubDate><description><![CDATA[Forty-five of them took it down.]]></description></item></channel></rss>`
    expect(parseRss(cdata)[0]).toEqual({
      title: 'Bots & swords',
      url: 'https://www.techhivelabs.net/blog/bots',
      date: '2026-07-25T00:00:00.000Z',
      summary: 'Forty-five of them took it down.'
    })
  })

  it('leaves readMinutes off a summary too short to be a body', () => {
    const short = `<rss><channel><item><title>t</title><link>https://www.techhivelabs.net/blog/t</link><pubDate>Sat, 25 Jul 2026 00:00:00 GMT</pubDate><description>${'word '.repeat(30)}</description></item></channel></rss>`
    expect(parseRss(short)[0]!.readMinutes).toBeUndefined()
  })

  it('drops items with no link or an unparseable date rather than rendering them', () => {
    const broken = `<rss><channel>
      <item><title>No link</title><pubDate>Sat, 25 Jul 2026 00:00:00 GMT</pubDate></item>
      <item><title>Bad date</title><link>https://www.techhivelabs.net/blog/bad</link><pubDate>whenever</pubDate></item>
      <item><title>Good</title><link>https://www.techhivelabs.net/blog/good</link><pubDate>Sat, 25 Jul 2026 00:00:00 GMT</pubDate></item>
    </channel></rss>`
    expect(parseRss(broken).map(p => p.title)).toEqual(['Good'])
  })

  it('falls back on a non-200 and on a body that is not a feed', async () => {
    const fallback = [{ title: 'f', url: 'https://www.techhivelabs.net/blog/f', date: '2026-01-01T00:00:00.000Z' }]
    const notFound = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    expect(await latestLabPosts(notFound, { url: 'x', timeoutMs: 5000, fallback })).toEqual(fallback)
    expect(await latestLabPosts(ok('<html>hello</html>'), { url: 'x', timeoutMs: 5000, fallback })).toEqual(fallback)
  })
})
