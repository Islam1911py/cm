import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin or Accountant access required" },
        { status: 403 }
      )
    }

    // --- التعديل هنا: قراءة البيانات اللي جاية من الزرار ---
    const body = await req.json()
    const { customAmount, customDay } = body

    const today = new Date()
    // لو المحاسب اختار يوم في الـ Dialog استخدمه، غير كدة استخدم يوم النهاردة
    const targetDay = customDay ? parseInt(customDay) : today.getDate()
    const currentMonth = today.toISOString().substring(0, 7) // YYYY-MM

    console.log(`[Monthly Billing] Generating for Day: ${targetDay}`)

    // بنجيب كل الوحدات اللي ميعاد تحصيلها (من الوحدة أو من المشروع) هو اليوم ده
    const allUnits = await db.operationalUnit.findMany({
      where: { isActive: true },
      include: {
        project: true,
        ownerAssociation: true
      }
    })
    const unitsToInvoice = allUnits.filter(
      (u) => (u.monthlyBillingDay ?? u.project.monthlyBillingDay ?? 1) === targetDay
    )

    const invoicesCreated: any[] = []
    const skipped: any[] = []

    for (const unit of unitsToInvoice) {
      // 1. نتأكد إن الفاتورة منزلتش للشقة دي في الشهر ده قبل كدة
      const invoiceNumber = `MGT-${currentMonth}-${unit.code}`
      const existingInvoice = await db.invoice.findFirst({
        where: {
          unitId: unit.id,
          invoiceNumber: invoiceNumber
        }
      })

      if (existingInvoice) {
        skipped.push({ unitCode: unit.code, reason: "موجودة بالفعل" })
        continue
      }

      // 2. نتأكد إن فيه اتحاد ملاك (مالك) مربوط عشان نعرف نطلع الفاتورة لمين
      if (!unit.ownerAssociation) {
        skipped.push({ unitCode: unit.code, reason: "لا يوجد مالك مربوط" })
        continue
      }

      // 3. تحديد المبلغ: لو المحاسب كتب مبلغ في الزرار استخدمه، لو سابها فاضية خد مبلغ الشقة الأصلي
      const amount = (customAmount && parseFloat(customAmount) > 0) 
                     ? parseFloat(customAmount) 
                     : (unit.monthlyManagementFee || 0)

      if (amount <= 0) continue

      try {
        const invoice = await db.invoice.create({
          data: {
            invoiceNumber,
            type: "MANAGEMENT_SERVICE",
            amount,
            unitId: unit.id,
            ownerAssociationId: unit.ownerAssociation.id,
            issuedAt: today,
            totalPaid: 0,
            remainingBalance: amount,
            isPaid: false
          }
        })

        invoicesCreated.push({
          invoiceNumber: invoice.invoiceNumber,
          unitCode: unit.code,
          amount: invoice.amount
        })
      } catch (error) {
        console.error(`Error creating invoice for ${unit.code}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalUnitsChecked: unitsToInvoice.length,
        invoicesCreated: invoicesCreated.length,
        skipped: skipped.length
      },
      invoicesCreated,
      skipped
    })
  } catch (error) {
    console.error("[Monthly Billing] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate monthly invoices" },
      { status: 500 }
    )
  }
}

// GET endpoint to check which units would be invoiced today
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin or Accountant access required" },
        { status: 403 }
      )
    }

    const today = new Date()
    const currentDay = today.getDate()

    const allUnits = await db.operationalUnit.findMany({
      where: {
        isActive: true,
        monthlyManagementFee: { gt: 0 }
      },
      include: {
        project: { select: { name: true, monthlyBillingDay: true } },
        ownerAssociation: { select: { name: true } }
      }
    })
    const unitsToInvoice = allUnits.filter(
      (u) => (u.monthlyBillingDay ?? u.project.monthlyBillingDay ?? 1) === currentDay
    )

    return NextResponse.json({
      billingDay: currentDay,
      unitsCount: unitsToInvoice.length,
      units: unitsToInvoice.map(unit => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        projectName: unit.project.name,
        monthlyFee: unit.monthlyManagementFee,
        billingDay: unit.monthlyBillingDay,
        ownerName: unit.ownerAssociation?.name || "No owner"
      }))
    })
  } catch (error) {
    console.error("[Monthly Billing Check] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to check billing schedule",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
