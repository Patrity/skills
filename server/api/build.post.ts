import { planFresh } from '~~/shared/setup/plan'
import { resolveBundles } from '~~/shared/setup/wizard'
import { toCliManifest } from '~~/server/lib/setup/manifest'
import { validateBuildInput } from '~~/server/lib/setup/build-input'
import { buildSetupZip } from '~~/server/lib/setup/setup-zip'
import type { BundleFiles } from '~~/shared/types/setup'

const MAX_BODY = 16 * 1024

export default defineEventHandler(async (event): Promise<Buffer> => {
  setHeader(event, 'Cache-Control', 'no-store')
  const raw = await readRawBody(event, 'utf8')
  if (!raw) throw createError({ statusCode: 400, statusMessage: 'body: expected JSON' })
  if (Buffer.byteLength(raw) > MAX_BODY) throw createError({ statusCode: 413, statusMessage: 'body too large' })
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'body: not valid JSON' })
  }

  const record = await getManifestsOr503()
  const registry = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  const manifest = toCliManifest(record, registry)
  if (manifest.errors.length) throw createError({ statusCode: 503, statusMessage: 'the base schema has errors; the builder is disabled' })
  const checked = validateBuildInput(json, manifest)
  if (!checked.ok) throw createError({ statusCode: checked.status, statusMessage: checked.message })
  const { projectName, answers } = checked.value
  const bundles = resolveBundles(checked.value.bundles, manifest.skills).bundles

  const bundleFiles: Record<string, BundleFiles> = {}
  for (const slug of bundles) {
    const files = await getBundleFilesOr503(slug)
    if (!files) throw createError({ statusCode: 400, statusMessage: `unknown bundle: ${slug}` })
    bundleFiles[slug] = files
  }
  const plan = planFresh({ manifest, projectName, answers, bundles, bundleFiles, registry })
  const zip = buildSetupZip(plan, new Date(record.meta.committedAt))
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${projectName}-claude-setup.zip"`)
  setHeader(event, 'Content-Length', zip.byteLength)
  return Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength)
})
