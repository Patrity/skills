import type { MarkdownBody, SkillFileResponse } from '~~/shared/types/skills'
import { detectLanguage } from '~~/shared/utils/language'
import { findFile } from '~~/server/lib/skills/tree'
import { isSafeRelativePath } from '~~/server/lib/skills/paths'
import { splitFrontmatter } from '~~/server/lib/skills/frontmatter'

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

  const files = await getBundleFilesOr503(slug)
  const bytes = files?.[path]
  // `undefined`, not falsy: a zero-byte file is a legitimate hit.
  if (bytes === undefined) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const language = detectLanguage(path)
  let content: string | null = null
  let frontmatterRaw: string | null = null
  let body: MarkdownBody | null = null
  if (node.kind === 'text') {
    content = decoder.decode(bytes)
    if (language === 'markdown') {
      frontmatterRaw = splitFrontmatter(content).matter.trim() || null
      try {
        // Rendering here is what keeps the parser and Shiki out of the browser.
        body = await renderMarkdown(content, `${slug}/${path}`)
      } catch (err) {
        // 5xx, not a null body: ISR caches 200s, so a bad render must not be pinned
        // as an empty page (same reasoning as getBundleFilesOr503).
        console.error('[skills] markdown render failed:', err)
        throw createError({ statusCode: 500, statusMessage: 'Could not render this file' })
      }
    }
  }
  return { path, language, size: node.size ?? bytes.byteLength, kind: node.kind ?? 'text', content, frontmatterRaw, body }
})
