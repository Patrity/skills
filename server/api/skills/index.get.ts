import type { SkillsListResponse } from '~~/shared/types/skills'

export default defineEventHandler(async (): Promise<SkillsListResponse> => {
  const { meta, skills } = await getManifestsOr503()
  return {
    ...meta,
    skills: skills
      .filter(s => isPublicSkill(s, meta))
      .map(({ tree: _tree, ...summary }) => summary)
  }
})
