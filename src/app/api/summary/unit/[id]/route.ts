import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: unitId } = await params

    // Fetch unit with project
    const unit = await db.operationalUnit.findUnique({
      where: { id: unitId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Get residents count
    const residentsCount = await db.resident.count({
      where: { unitId },
    })

    // Get tickets stats
    const [totalTickets, newTickets, inProgressTickets, doneTickets] = await Promise.all([
      db.ticket.count({ where: { unitId } }),
      db.ticket.count({ where: { unitId, status: "NEW" } }),
      db.ticket.count({ where: { unitId, status: "IN_PROGRESS" } }),
      db.ticket.count({ where: { unitId, status: "DONE" } }),
    ])

    // Get deliveries stats
    const [totalDeliveries, newDeliveries, inProgressDeliveries, deliveredDeliveries] = await Promise.all([
      db.deliveryOrder.count({ where: { unitId } }),
      db.deliveryOrder.count({ where: { unitId, status: "NEW" } }),
      db.deliveryOrder.count({ where: { unitId, status: "IN_PROGRESS" } }),
      db.deliveryOrder.count({ where: { unitId, status: "DELIVERED" } }),
    ])

    // Get active tickets count
    const activeTicketsCount = await db.ticket.count({
      where: {
        unitId,
        status: { in: ["NEW", "IN_PROGRESS"] },
      },
    })

    // Get pending deliveries count
    const pendingDeliveriesCount = await db.deliveryOrder.count({
      where: {
        unitId,
        status: { in: ["NEW", "IN_PROGRESS"] },
      },
    })

    // Get technician work stats
    const [totalTechWork, techWorkStats] = await Promise.all([
      db.technicianWork.count({ where: { unitId } }),
      db.technicianWork.aggregate({
        where: { unitId },
        _sum: { amount: true },
      }),
    ])

    // Get expense notes stats
    const [totalExpenseNotes, pendingExpenseNotes, expenseNotesStats] = await Promise.all([
      db.unitExpense.count({ where: { unitId } }),
      db.unitExpense.count({ where: { unitId, isClaimed: false } }),
      db.unitExpense.aggregate({
        where: { unitId },
        _sum: { amount: true },
      }),
    ])

    // Get invoices stats
    const [totalInvoices, paidInvoices, unpaidInvoices] = await Promise.all([
      db.invoice.count({ where: { unitId } }),
      db.invoice.count({ where: { unitId, isPaid: true } }),
      db.invoice.count({ where: { unitId, isPaid: false } }),
    ])

    const summary = {
      unit: {
        id: unit.id,
        name: unit.name,
        code: unit.code,
        type: unit.type,
        isActive: unit.isActive,
        monthlyManagementFee: unit.monthlyManagementFee,
        monthlyBillingDay: unit.monthlyBillingDay,
        project: unit.project,
      },
      residents: {
        total: residentsCount,
        activeTickets: activeTicketsCount,
        pendingDeliveries: pendingDeliveriesCount,
      },
      tickets: {
        total: totalTickets,
        new: newTickets,
        inProgress: inProgressTickets,
        done: doneTickets,
      },
      deliveries: {
        total: totalDeliveries,
        new: newDeliveries,
        inProgress: inProgressDeliveries,
        delivered: deliveredDeliveries,
      },
      technicianWork: {
        total: totalTechWork,
        totalAmount: techWorkStats._sum.amount || 0,
      },
      expenseNotes: {
        total: totalExpenseNotes,
        pending: pendingExpenseNotes,
        totalAmount: expenseNotesStats._sum.amount || 0,
      },
      invoices: {
        total: totalInvoices,
        paid: paidInvoices,
        unpaid: unpaidInvoices,
      },
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error("Error fetching unit summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch unit summary" },
      { status: 500 }
    )
  }
}
