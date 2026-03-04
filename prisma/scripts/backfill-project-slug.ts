/**
 * يملأ حقل slug لجميع المشاريع من الاسم (نفس منطق البحث — أي اسم مشروع يطابق بعدها).
 * تشغيل مرة واحدة للمشاريع اللي slug فيها null: npm run db:backfill-project-slug
 */
import { PrismaClient } from "@prisma/client"
import { projectSlugForCreate } from "@/lib/project-slug"

const db = new PrismaClient()

async function main() {
  const projects = await db.project.findMany({ select: { id: true, name: true, slug: true } })
  const usedSlugs = new Set<string>()
  let updated = 0
  for (const p of projects) {
    if (p.slug != null) {
      usedSlugs.add(p.slug)
      continue
    }
    let slug = projectSlugForCreate(p.name)
    if (usedSlugs.has(slug)) slug = `${slug}-${p.id.slice(0, 8)}`
    usedSlugs.add(slug)
    await db.project.update({ where: { id: p.id }, data: { slug } })
    updated++
    console.log(`Updated ${p.name} → slug: ${slug}`)
  }
  console.log(`Done. Updated ${updated} of ${projects.length} projects.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
