/**
 * حذف تكرارات (projectId, invoiceNumber) قبل db push
 * يمسك صف واحد ويحذف الباقي. يعمل بـ Node فقط عشان الـ Docker يشتغله
 * تشغيل: node prisma/scripts/fix-invoice-duplicates.js
 */
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  let dupes
  try {
    dupes = await db.$queryRaw`
      SELECT "projectId", "invoiceNumber", COUNT(*) as count
      FROM "Invoice"
      WHERE "projectId" IS NOT NULL
      GROUP BY "projectId", "invoiceNumber"
      HAVING COUNT(*) > 1
    `
  } catch (e) {
    // العمود projectId مش موجود = الداتابيز لسه بالـ schema القديم، خلّي db push يطبّق الأول
    if (e.code === 'P2010' || e.meta?.code === '42703') {
      console.log('[prisma-fix] projectId column not in DB yet, skipping. db push will apply schema.')
      return
    }
    throw e
  }

  if (dupes.length === 0) {
    console.log('[prisma-fix] No duplicate (projectId, invoiceNumber). Safe to db push.')
    return
  }

  console.log(`[prisma-fix] Found ${dupes.length} duplicate(s). Deleting extras...`)
  let deleted = 0

  for (const d of dupes) {
    const invoices = await db.invoice.findMany({
      where: {
        projectId: d.projectId,
        invoiceNumber: d.invoiceNumber
      },
      orderBy: { id: 'asc' },
      select: { id: true }
    })

    for (let i = 1; i < invoices.length; i++) {
      await db.invoice.delete({ where: { id: invoices[i].id } })
      deleted++
    }
  }

  console.log(`[prisma-fix] Deleted ${deleted} duplicate invoice(s).`)
}

main()
  .catch((e) => {
    console.error('[prisma-fix]', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
