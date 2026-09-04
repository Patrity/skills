import type { CliManifest } from '~~/shared/types/setup'

export default defineEventHandler(async (): Promise<CliManifest> => {
  const { meta, skills, base, baseErrors, profiles, profileErrors } = await getManifestsOr503()
  const registry = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  return {
    ...meta,
    registry,
    base,
    profiles,
    skills: skills.filter(s => isPublicSkill(s, meta)).map(({ tree: _tree, ...summary }) => summary),
    errors: [...baseErrors, ...profileErrors]
  }
})
