import type { StatusResponse } from '~~/shared/types/skills'

export default defineEventHandler(async (): Promise<StatusResponse> => {
  const { meta } = await getManifestsOr503()
  return { ok: true, ...meta }
})
