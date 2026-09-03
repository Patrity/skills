import matter from 'gray-matter'
import type { SkillFileResponse } from '~~/shared/types/skills'
import { detectLanguage } from '~~/shared/utils/language'
import { findFile } from '~~/server/lib/skills/tree'
import { isSafeRelativePath } from '~~/server/lib/skills/paths'

const decoder = new TextDecoder()

export default defineEventHandler(async (event): Promise<SkillFileResponse> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  let path: string
  try {
    path = (getRouterParam(event, 'path') ?? '').split('/').map(decodeURIComponent).join('/')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }
  if (!isSafeRelativePath(path)) throw createError({ statusCode: 400, statusMessage: 'Invalid path' })

  const { skill } = await requirePublicSkill(slug)
  const node = findFile(skill.tree, path)
  if (!node) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const files = await useSkillsStore().getBundleFiles(slug)
  const bytes = files?.[path]
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const language = detectLanguage(path)
  let content: string | null = null
  let frontmatterRaw: string | null = null
  if (node.kind === 'text') {
    content = decoder.decode(bytes)
    if (language === 'markdown') {
      // gray-matter 4.0.3 caches by input string, and its cache-hit path returns
      // `Object.assign({}, cached)` — but `.matter` is defined non-enumerable on the
      // cached object, so a second call with identical content loses it. Passing an
      // (empty) options object skips the cache. See frontmatter.ts for the same fix.
      const parsed = matter(content, {})
      frontmatterRaw = parsed.matter.trim() || null
    }
  }
  return { path, language, size: node.size ?? bytes.byteLength, kind: node.kind ?? 'text', content, frontmatterRaw }
})
