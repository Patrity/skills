import type { BaseResponse } from '~~/shared/types/setup'

export default defineEventHandler(async (): Promise<BaseResponse> => {
  const { meta, base, baseErrors } = await getManifestsOr503()
  return { ...meta, base, errors: baseErrors }
})
