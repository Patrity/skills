import type { ProfilesResponse } from '~~/shared/types/setup'

export default defineEventHandler(async (): Promise<ProfilesResponse> => {
  const { meta, profiles, profileErrors } = await getManifestsOr503()
  return { ...meta, profiles, errors: profileErrors }
})
