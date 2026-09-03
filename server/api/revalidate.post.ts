import { invalidateByTag } from '@vercel/functions'
import type { StatusResponse } from '~~/shared/types/skills'
import { CACHE_TAG } from '~~/server/lib/skills/store'

/** Called by CI after a push touching skills/**. Purges CDN + Runtime Cache, then warms the store. */
export default defineEventHandler(async (event): Promise<StatusResponse> => {
  const config = useRuntimeConfig()
  const auth = getHeader(event, 'authorization') ?? ''
  if (!config.revalidateSecret || auth !== `Bearer ${config.revalidateSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (process.env.VERCEL) await invalidateByTag(CACHE_TAG)
  const meta = await useSkillsStore().refresh()
  return { ok: true, ...meta }
})
