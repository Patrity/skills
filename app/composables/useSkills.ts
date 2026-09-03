import type { SkillDetailResponse, SkillFileResponse, SkillsListResponse } from '~~/shared/types/skills'

export function useSkillsList() {
  return useFetch<SkillsListResponse>('/api/skills', { key: 'skills:list' })
}

export function useSkill(slug: MaybeRefOrGetter<string>) {
  return useFetch<SkillDetailResponse>(() => `/api/skills/${encodeURIComponent(toValue(slug))}`)
}

export function useSkillFile(slug: MaybeRefOrGetter<string>, path: MaybeRefOrGetter<string>) {
  return useFetch<SkillFileResponse>(() => {
    const encodedPath = toValue(path).split('/').map(encodeURIComponent).join('/')
    return `/api/skills/${encodeURIComponent(toValue(slug))}/file/${encodedPath}`
  })
}
