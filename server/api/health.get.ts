export default defineEventHandler(async () => {
  const { meta } = await useSkillsStore().getManifests()
  return { ok: true, ...meta }
})
