import { buildZip } from '~~/server/lib/skills/zip'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const { meta } = await requirePublicSkill(slug)
  const files = await getBundleFilesOr503(slug)
  if (!files) throw createError({ statusCode: 404, statusMessage: 'Skill not found' })

  const zip = buildZip(slug, files, new Date(meta.committedAt))
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${slug}.zip"`)
  setHeader(event, 'Content-Length', zip.byteLength)
  return Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength)
})
