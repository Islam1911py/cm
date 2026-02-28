import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/** حذف عدة وحدات تشغيلية مع كل بياناتهم المرتبطة */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") as string[] : []

    if (ids.length === 0) {
      return NextResponse.json({ error: "أرسل مصفوفة ids غير فارغة" }, { status: 400 })
    }

    const units = await db.operationalUnit.findMany({
      where: { id: { in: ids } },
      select: { id: true }
    })
    const foundIds = new Set(units.map((u) => u.id))
    const notFound = ids.filter((id) => !foundIds.has(id))
    if (notFound.length > 0) {
      return NextResponse.json(
        { error: "وحدات غير موجودة", notFound },
        { status: 404 }
      )
    }

    for (const unit of units) {
      const unitId = unit.id
      await db.$transaction(async (tx) => {
        const unitInvoices = await tx.invoice.findMany({ where: { unitId }, select: { id: true } })
        const invoiceIds = unitInvoices.map((i) => i.id)
        await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
        await tx.unitExpense.updateMany({ where: { unitId }, data: { claimInvoiceId: null } })
        await tx.operationalExpense.updateMany({ where: { unitId }, data: { claimInvoiceId: null } })
        await tx.invoice.deleteMany({ where: { unitId } })
        await tx.operationalExpense.updateMany({ where: { unitId }, data: { convertedFromNoteId: null } })
        await tx.accountingNote.deleteMany({ where: { unitId } })
        await tx.deliveryOrder.deleteMany({ where: { unitId } })
        await tx.ticket.deleteMany({ where: { unitId } })
        await tx.resident.deleteMany({ where: { unitId } })
        await tx.unitExpense.updateMany({ where: { unitId }, data: { technicianWorkId: null, staffWorkLogId: null } })
        await tx.technicianWork.deleteMany({ where: { unitId } })
        await tx.staffWorkLog.deleteMany({ where: { unitId } })
        await tx.staffUnitAssignment.deleteMany({ where: { unitId } })
        const staffInUnit = await tx.staff.findMany({ where: { unitId }, select: { id: true } })
        const staffIds = staffInUnit.map((s) => s.id)
        if (staffIds.length > 0) {
          await tx.staffAdvance.deleteMany({ where: { staffId: { in: staffIds } } })
          await tx.payrollItem.deleteMany({ where: { staffId: { in: staffIds } } })
          const advances = await tx.pmAdvance.findMany({ where: { staffId: { in: staffIds } }, select: { id: true } })
          await tx.operationalExpense.updateMany({
            where: { pmAdvanceId: { in: advances.map((a) => a.id) } },
            data: { pmAdvanceId: null }
          })
          await tx.unitExpense.updateMany({
            where: { pmAdvanceId: { in: advances.map((a) => a.id) } },
            data: { pmAdvanceId: null }
          })
          await tx.accountingNote.updateMany({
            where: { pmAdvanceId: { in: advances.map((a) => a.id) } },
            data: { pmAdvanceId: null }
          })
          await tx.pmAdvance.deleteMany({ where: { staffId: { in: staffIds } } })
          await tx.staffProjectAssignment.deleteMany({ where: { staffId: { in: staffIds } } })
          await tx.staff.deleteMany({ where: { unitId } })
        }
        await tx.ownerAssociation.deleteMany({ where: { unitId } })
        await tx.unitExpense.deleteMany({ where: { unitId } })
        await tx.operationalExpense.deleteMany({ where: { unitId } })
        await tx.operationalUnit.delete({ where: { id: unitId } })
      })
    }

    return NextResponse.json({
      success: true,
      message: `تم حذف ${units.length} وحدة/وحدات`,
      deleted: units.length
    })
  } catch (error) {
    console.error("Bulk delete units:", error)
    return NextResponse.json(
      { error: "فشل الحذف الجماعي", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
