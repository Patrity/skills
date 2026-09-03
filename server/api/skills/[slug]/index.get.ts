import type { SkillDetailResponse } from '~~/shared/types/skills'

export default defineEventHandler(async (event): Promise<SkillDetailResponse> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const { skill, meta } = await requirePublicSkill(slug)
  return { ...meta, skill }
})
