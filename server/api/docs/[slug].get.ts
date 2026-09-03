import type { DocResponse } from '~~/shared/types/docs'
import { docsNav } from '~~/content/docs/nav'

export default defineEventHandler(async (event): Promise<DocResponse> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const entry = docsNav.find(d => d.slug === slug)
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Doc not found' })

  // nuxt.config bundles content/docs as the `docs` server asset; keys are the file names
  // exactly as they sit on disk (verified: getKeys() → ['getting-started.md', …]).
  const md = await useStorage('assets:docs').getItem<string>(entry.file)
  if (typeof md !== 'string') throw createError({ statusCode: 404, statusMessage: 'Doc not found' })

  return { entry, body: await renderMarkdown(md, `docs/${entry.file}`) }
})
