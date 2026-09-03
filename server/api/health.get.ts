export default defineEventHandler(async () => {
  const { meta } = await getManifestsOr503()
  return { ok: true, ...meta }
})
