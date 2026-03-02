import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { projectSlugForCreate } from "@/lib/project-slug"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, isActive, monthlyBillingDay } = body

    const data: { name?: string; slug?: string | null; isActive?: boolean; monthlyBillingDay?: number | null } = {}
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim()
      data.slug = projectSlugForCreate(data.name)
    }
    if (typeof isActive === "boolean") {
      data.isActive = isActive
    }
    if (monthlyBillingDay !== undefined) {
      data.monthlyBillingDay =
        monthlyBillingDay === null || monthlyBillingDay === ""
          ? null
          : typeof monthlyBillingDay === "number"
            ? monthlyBillingDay
            : parseInt(String(monthlyBillingDay), 10)
      if (data.monthlyBillingDay !== null && (Number.isNaN(data.monthlyBillingDay) || data.monthlyBillingDay < 1 || data.monthlyBillingDay > 31)) {
        return NextResponse.json(
          { error: "monthlyBillingDay must be between 1 and 31" },
          { status: 400 }
        )
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Send at least one of: name, isActive, monthlyBillingDay" },
        { status: 400 }
      )
    }

    if (data.name) {
      const existing = await db.project.findFirst({
        where: { name: data.name, id: { not: id } }
      })
      if (existing) {
        return NextResponse.json(
          { error: "اسم مشروع آخر مستخدم مسبقاً" },
          { status: 400 }
        )
      }
    }

    const project = await db.project.update({
      where: { id },
      data
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    )
  }
}

/** حذف مشروع مع كل وحداته وكل البيانات المرتبطة دفعة واحدة */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: { operationalUnits: { select: { id: true } } }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      const unitIds = project.operationalUnits.map((u) => u.id)

      for (const unitId of unitIds) {
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
      }

      const projectInvoiceIds = await tx.invoice.findMany({
        where: { projectId: id },
        select: { id: true }
      })
      const ids = projectInvoiceIds.map((i) => i.id)
      if (ids.length > 0) {
        await tx.payment.deleteMany({ where: { invoiceId: { in: ids } } })
      }
      await tx.invoice.deleteMany({ where: { projectId: id } })
      await tx.accountingNote.deleteMany({ where: { projectId: id } })
      await tx.pmAdvance.deleteMany({ where: { projectId: id } })
      await tx.projectAssignment.deleteMany({ where: { projectId: id } })
      await tx.projectElement.deleteMany({ where: { projectId: id } })
      await tx.staffProjectAssignment.deleteMany({ where: { projectId: id } })
      await tx.project.delete({ where: { id } })
    })

    return NextResponse.json({ success: true, message: "تم حذف المشروع وجميع وحداته وبياناته" })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Failed to delete project", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
