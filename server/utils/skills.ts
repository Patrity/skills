import { getCache } from '@vercel/functions'
import type { SkillManifest, SnapshotMeta } from '~~/shared/types/skills'
import { createSnapshotStore, type SnapshotStore } from '../lib/skills/store'
import { createFsSource } from '../lib/skills/fs-source'
import { createGithubSource } from '../lib/skills/github-source'

let store: SnapshotStore | undefined

/** One store per Nitro instance. `github` mode adds the Vercel Runtime Cache; `fs` mode reads disk on every request. */
export function useSkillsStore(): SnapshotStore {
  if (store) return store
  const config = useRuntimeConfig()
  const github = config.skillsSource === 'github'
  const source = github
    ? createGithubSource({ ...config.public.github, token: config.githubToken || undefined })
    : createFsSource(config.skillsDir)
  store = createSnapshotStore({ source, cache: github ? getCache({ namespace: 'skills' }) : null })
  return store
}

/** Invalid bundles are visible (with their errors) only when reading from disk. */
export function isPublicSkill(skill: SkillManifest, meta: SnapshotMeta): boolean {
  return meta.source === 'fs' || skill.errors.length === 0
}

export async function requirePublicSkill(slug: string): Promise<{ skill: SkillManifest, meta: SnapshotMeta }> {
  const { meta, skills } = await useSkillsStore().getManifests()
  const skill = skills.find(s => s.slug === slug)
  if (!skill || !isPublicSkill(skill, meta)) {
    throw createError({ statusCode: 404, statusMessage: 'Skill not found' })
  }
  return { skill, meta }
}
