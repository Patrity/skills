import { timingSafeEqual } from 'node:crypto'
import { invalidateByTag } from '@vercel/functions'
import type { StatusResponse } from '~~/shared/types/skills'
import { CACHE_TAG } from '~~/server/lib/skills/store'

/**
 * `timingSafeEqual` throws on a buffer-length mismatch, so unequal lengths must be
 * ruled out first — that early return still leaks the length, never the content, and
 * is the standard shape for this check (the alternative, comparing against a
 * fixed-length hash, is overkill for a bearer secret already read from config).
 */
function safeBearerEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/** Called by CI after a push touching skills/**. Purges CDN + Runtime Cache, then warms the store. */
export default defineEventHandler(async (event): Promise<StatusResponse> => {
  const config = useRuntimeConfig()
  const auth = getHeader(event, 'authorization') ?? ''
  if (!config.revalidateSecret || !safeBearerEqual(auth, `Bearer ${config.revalidateSecret}`)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (process.env.VERCEL) await invalidateByTag(CACHE_TAG)
  const meta = await useSkillsStore().refresh()
  return { ok: true, ...meta }
})
