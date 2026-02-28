/**
 * إصلاح تكرارات (projectId, invoiceNumber) في جدول Invoice
 * قبل تطبيق الـ migration التي تضيف @@unique([projectId, invoiceNumber])
 *
 * تشغيل: npx tsx prisma/scripts/fix-invoice-duplicates.ts
 * يتطلب: DATABASE_URL في .env
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  // 1) إيجاد كل (projectId, invoiceNumber) المكررة (حيث projectId ليس null)
  type DupeRow = { projectId: string; invoiceNumber: string; count: bigint }
  const dupes = await db.$queryRaw<DupeRow[]>`
    SELECT "projectId", "invoiceNumber", COUNT(*) as count
    FROM "Invoice"
    WHERE "projectId" IS NOT NULL
    GROUP BY "projectId", "invoiceNumber"
    HAVING COUNT(*) > 1
  `

  if (dupes.length === 0) {
    console.log("لا توجد تكرارات لـ (projectId, invoiceNumber). يمكن تشغيل الـ migration بأمان.")
    return
  }

  console.log(`تم العثور على ${dupes.length} زوج (projectId, invoiceNumber) مكرر. جاري الإصلاح...`)

  let fixed = 0
  for (const d of dupes) {
    // جلب كل الفواتير بهذا الزوج مرتبة بـ id (نحتفظ بالأول ونعدّل الباقي)
    const invoices = await db.invoice.findMany({
      where: {
        projectId: d.projectId,
        invoiceNumber: d.invoiceNumber
      },
      orderBy: { id: "asc" },
      select: { id: true, invoiceNumber: true }
    })

    // الأول نتركه كما هو، من الثاني فصاعداً نغيّر invoiceNumber ليكون فريداً
    for (let i = 1; i < invoices.length; i++) {
      const inv = invoices[i]
      const newNumber = `${inv.invoiceNumber}-${inv.id.slice(-6)}`
      await db.invoice.update({
        where: { id: inv.id },
        data: { invoiceNumber: newNumber }
      })
      console.log(`  تم تحديث الفاتورة ${inv.id}: ${inv.invoiceNumber} → ${newNumber}`)
      fixed++
    }
  }

  console.log(`تم إصلاح ${fixed} فاتورة. يمكنك الآن تشغيل: npx prisma migrate deploy (أو migrate dev).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
