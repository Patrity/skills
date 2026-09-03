import type { SkillDetailResponse, SkillFileResponse, SkillsListResponse } from '~~/shared/types/skills'
import { encodePathSegments } from '~~/shared/utils/paths'

export function useSkillsList() {
  return useFetch<SkillsListResponse>('/api/skills', { key: 'skills:list' })
}

export function useSkill(slug: MaybeRefOrGetter<string>) {
  return useFetch<SkillDetailResponse>(() => `/api/skills/${encodeURIComponent(toValue(slug))}`)
}

export function useSkillFile(slug: MaybeRefOrGetter<string>, path: MaybeRefOrGetter<string>) {
  return useFetch<SkillFileResponse>(
    () => `/api/skills/${encodeURIComponent(toValue(slug))}/file/${encodePathSegments(toValue(path))}`
  )
}
