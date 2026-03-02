/**
 * يملأ حقل slug لجميع الوحدات من الاسم (داخل كل مشروع؛ ليس فريداً globally).
 * تشغيل مرة واحدة بعد إضافة العمود: npm run db:backfill-unit-slug
 */
import { PrismaClient } from "@prisma/client"
import { unitNameToMatchSlug } from "../../src/lib/project-slug"

const db = new PrismaClient()

async function main() {
  const units = await db.operationalUnit.findMany({
    select: { id: true, name: true, slug: true, projectId: true }
  })
  let updated = 0
  for (const u of units) {
    const slug = unitNameToMatchSlug(u.name) || null
    if (slug !== u.slug) {
      await db.operationalUnit.update({ where: { id: u.id }, data: { slug } })
      updated++
    }
  }
  console.log(`Done. Updated ${updated} of ${units.length} units.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
