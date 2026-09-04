export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ markdown?: unknown }>(event)
  const md = body?.markdown
  if (typeof md !== 'string') throw createError({ statusCode: 400, statusMessage: 'markdown: expected a string' })
  if (Buffer.byteLength(md) > 256 * 1024) throw createError({ statusCode: 413, statusMessage: 'markdown too large' })
  return renderMarkdown(md, 'CLAUDE.md')
})
