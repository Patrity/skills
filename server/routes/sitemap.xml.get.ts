export default defineEventHandler(async (event) => {
  const base = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  const { meta, skills } = await useSkillsStore().getManifests()
  const paths = [
    '/',
    '/skills',
    '/docs',
    ...skills.filter(s => isPublicSkill(s, meta)).map(s => `/skill/${s.slug}`)
  ]
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + paths.map(p => `  <url><loc>${base}${p}</loc></url>`).join('\n')
    + `\n</urlset>\n`
})
