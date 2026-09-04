import { getCache } from '@vercel/functions'
import type { SkillManifest, SnapshotMeta } from '~~/shared/types/skills'
import { createSnapshotStore, type ManifestRecord, type SnapshotStore } from '../lib/skills/store'
import { isPublicSkill } from '../lib/skills/public'
import type { BundleFiles } from '../lib/skills/types'
import { createFsSource } from '../lib/skills/fs-source'
import { createGithubSource } from '../lib/skills/github-source'

/** Re-exported (and auto-imported by routes) from the pure module the CLI manifest projection uses. */
export { isPublicSkill }

let store: SnapshotStore | undefined

/** One store per Nitro instance. `github` mode adds the Vercel Runtime Cache; `fs` mode reads disk on every request. */
export function useSkillsStore(): SnapshotStore {
  if (store) return store
  const config = useRuntimeConfig()
  const github = config.skillsSource === 'github'
  const source = github
    ? createGithubSource({ ...config.public.github, token: config.githubToken || undefined })
    : createFsSource(config.skillsDir)
  store = createSnapshotStore({
    source,
    cache: github ? getCache({ namespace: 'skills' }) : null,
    // Warm instances re-check the Runtime Cache within ~5s of a purge, so a revalidate
    // converges long before the 5-minute ISR floor. Irrelevant without a cache (fs).
    ...(github ? { memoTtl: 5_000 } : {})
  })
  return store
}

/**
 * Upstream failures must surface as 5xx, never as a cacheable 404 or an empty 200:
 * Vercel ISR caches 200/404 responses but keeps serving the stale copy on 5xx.
 */
function unavailable(err: unknown): never {
  console.error('[skills] source unavailable:', err)
  throw createError({ statusCode: 503, statusMessage: 'Skills source unavailable' })
}

export async function getManifestsOr503(): Promise<ManifestRecord> {
  try {
    return await useSkillsStore().getManifests()
  } catch (err) {
    unavailable(err)
  }
}

export async function getBundleFilesOr503(slug: string): Promise<BundleFiles | null> {
  try {
    return await useSkillsStore().getBundleFiles(slug)
  } catch (err) {
    unavailable(err)
  }
}

export async function requirePublicSkill(slug: string): Promise<{ skill: SkillManifest, meta: SnapshotMeta }> {
  const { meta, skills } = await getManifestsOr503()
  const skill = skills.find(s => s.slug === slug)
  if (!skill || !isPublicSkill(skill, meta)) {
    throw createError({ statusCode: 404, statusMessage: 'Skill not found' })
  }
  return { skill, meta }
}
