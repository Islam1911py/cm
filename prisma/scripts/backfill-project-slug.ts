/**
 * يملأ حقل slug لجميع المشاريع من الاسم (slug مطلوب وفريد).
 * تشغيل مرة واحدة بعد إضافة العمود: npm run db:backfill-project-slug
 */
import { PrismaClient } from "@prisma/client"
import { projectSlugForCreate } from "../../src/lib/project-slug"

const db = new PrismaClient()

async function main() {
  const projects = await db.project.findMany({ select: { id: true, name: true, slug: true } })
  let updated = 0
  for (const p of projects) {
    const slug = projectSlugForCreate(p.name)
    if (slug !== p.slug) {
      await db.project.update({ where: { id: p.id }, data: { slug } })
      updated++
      console.log(`Updated ${p.name} → slug: ${slug}`)
    }
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
