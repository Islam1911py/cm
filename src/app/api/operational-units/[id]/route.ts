import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { unitNameToMatchSlug } from "@/lib/project-slug"

// GET /api/operational-units/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const unit = await db.operationalUnit.findUnique({
      where: { id },
      include: {
        project: true,
        _count: {
          select: { residents: true, tickets: true, deliveryOrders: true }
        }
      }
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error fetching operational unit:", error)
    return NextResponse.json({ error: "Failed to fetch operational unit" }, { status: 500 })
  }
}

// PUT /api/operational-units/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, code, type, typeId, isActive } = body

    let typeName: string | undefined
    let resolvedTypeId: string | null | undefined
    if (typeId !== undefined) {
      if (typeId == null || typeId === "") {
        resolvedTypeId = null
        if (type) typeName = String(type).trim()
      } else {
        const unitType = await db.unitType.findUnique({ where: { id: typeId } })
        if (!unitType) return NextResponse.json({ error: "Unit type not found" }, { status: 400 })
        typeName = unitType.name
        resolvedTypeId = typeId
      }
    } else if (type) {
      typeName = String(type).trim()
    }

    const unit = await db.operationalUnit.update({
      where: { id },
      data: {
        ...(name && { name, slug: unitNameToMatchSlug(name) || null }),
        ...(code && { code }),
        ...(typeName !== undefined && { type: typeName }),
        ...(resolvedTypeId !== undefined && { typeId: resolvedTypeId }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        project: true,
        unitType: { select: { id: true, name: true } },
        _count: {
          select: { residents: true, tickets: true, deliveryOrders: true }
        }
      }
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error updating operational unit:", error)
    return NextResponse.json({ error: "Failed to update operational unit" }, { status: 500 })
  }
}

// PATCH /api/operational-units/[id] - For partial updates (billing info)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN and ACCOUNTANT can update billing
    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { monthlyManagementFee, monthlyBillingDay } = body

    const updateData: any = {}
    if (monthlyManagementFee !== undefined) {
      updateData.monthlyManagementFee = monthlyManagementFee
    }
    if (monthlyBillingDay !== undefined) {
      updateData.monthlyBillingDay = monthlyBillingDay
    }

    const unit = await db.operationalUnit.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
        _count: {
          select: { residents: true, tickets: true, deliveryOrders: true }
        }
      }
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error updating billing info:", error)
    return NextResponse.json({ error: "Failed to update billing info" }, { status: 500 })
  }
}

// DELETE /api/operational-units/[id] — حذف الوحدة وكل بياناتها المرتبطة
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const unit = await db.operationalUnit.findUnique({ where: { id }, select: { id: true } })
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      const unitId = id
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting operational unit:", error)
    return NextResponse.json({ error: "Failed to delete operational unit" }, { status: 500 })
  }
}
