import type { CliManifest } from '~~/shared/types/setup'
import { toCliManifest } from '~~/server/lib/setup/manifest'

export default defineEventHandler(async (): Promise<CliManifest> => {
  return toCliManifest(await getManifestsOr503(), useRuntimeConfig().public.siteUrl)
})
