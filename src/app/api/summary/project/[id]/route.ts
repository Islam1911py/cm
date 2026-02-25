import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/summary/project/[id] - Get comprehensive project summary aggregating all units
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

    // Fetch project with all units and their data
    const project = await db.project.findUnique({
      where: { id },
      include: {
        projectType: true,
        operationalUnits: {
          include: {
            residents: true,
            tickets: true,
            deliveryOrders: true,
            invoices: {
              include: {
                payments: true
              }
            },
            technicianWorks: true,
            staff: true,
            staffWorkLogs: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check access permission for PROJECT_MANAGER
    if (session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const assignment = await db.projectAssignment.findFirst({
        where: {
          userId: session.user.id,
          projectId: id
        }
      })
      if (!assignment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const units = project.operationalUnits

    // Aggregate all data across units
    let ticketsSummary = {
      total: 0,
      new: 0,
      inProgress: 0,
      done: 0
    }

    let deliveriesSummary = {
      total: 0,
      new: 0,
      inProgress: 0,
      delivered: 0
    }

    let expenseNotesSummary = {
      total: 0,
      pending: 0,
      recorded: 0,
      totalAmount: 0
    }

    let technicianWorkSummary = {
      total: 0,
      paid: 0,
      unpaid: 0,
      totalCost: 0,
      paidAmount: 0,
      unpaidAmount: 0
    }

    let staffPayrollSummary = {
      totalStaff: 0,
      activeStaff: 0,
      workLogCount: 0,
      totalCost: 0,
      paidAmount: 0,
      unpaidAmount: 0
    }

    let invoicesSummary = {
      total: 0,
      paid: 0,
      unpaid: 0,
      partial: 0,
      totalAmount: 0,
      totalPaid: 0
    }

    let residentsSummary = {
      total: 0,
      activeTickets: 0,
      pendingDeliveries: 0
    }

    // Aggregate across all units
    units.forEach(unit => {
      // Tickets
      ticketsSummary.total += unit.tickets.length
      ticketsSummary.new += unit.tickets.filter(t => t.status === "NEW").length
      ticketsSummary.inProgress += unit.tickets.filter(t => t.status === "IN_PROGRESS").length
      ticketsSummary.done += unit.tickets.filter(t => t.status === "DONE").length

      // Deliveries
      deliveriesSummary.total += unit.deliveryOrders.length
      deliveriesSummary.new += unit.deliveryOrders.filter(d => d.status === "NEW").length
      deliveriesSummary.inProgress += unit.deliveryOrders.filter(d => d.status === "IN_PROGRESS").length
      deliveriesSummary.delivered += unit.deliveryOrders.filter(d => d.status === "DELIVERED").length

      // Expense Notes - Not included in project route, set to 0
      // (These would need to be fetched separately via accounting-notes API)
      expenseNotesSummary.total += 0
      expenseNotesSummary.pending += 0
      expenseNotesSummary.recorded += 0
      expenseNotesSummary.totalAmount += 0

      // Technician Work
      technicianWorkSummary.total += unit.technicianWorks.length
      technicianWorkSummary.paid += unit.technicianWorks.filter(w => w.isPaid).length
      technicianWorkSummary.unpaid += unit.technicianWorks.filter(w => !w.isPaid).length
      technicianWorkSummary.totalCost += unit.technicianWorks.reduce((sum, w) => sum + (w.amount ?? 0), 0)
      technicianWorkSummary.paidAmount += unit.technicianWorks
        .filter(w => w.isPaid)
        .reduce((sum, w) => sum + (w.amount ?? 0), 0)
      technicianWorkSummary.unpaidAmount += unit.technicianWorks
        .filter(w => !w.isPaid)
        .reduce((sum, w) => sum + (w.amount ?? 0), 0)

      // Staff Payroll
      staffPayrollSummary.totalStaff += unit.staff.length
      staffPayrollSummary.activeStaff += unit.staff.filter(s => s.status === "ACTIVE").length
      staffPayrollSummary.workLogCount += unit.staffWorkLogs.length
      staffPayrollSummary.totalCost += unit.staffWorkLogs.reduce((sum, log) => sum + log.amount, 0)
      staffPayrollSummary.paidAmount += unit.staffWorkLogs
        .filter(log => log.isPaid)
        .reduce((sum, log) => sum + log.amount, 0)
      staffPayrollSummary.unpaidAmount += unit.staffWorkLogs
        .filter(log => !log.isPaid)
        .reduce((sum, log) => sum + log.amount, 0)

      // Invoices
      invoicesSummary.total += unit.invoices.length
      unit.invoices.forEach(inv => {
        const totalPaid = inv.payments.reduce((sum, p) => sum + p.amount, 0)
        if (totalPaid === inv.amount) {
          invoicesSummary.paid++
        } else if (totalPaid === 0) {
          invoicesSummary.unpaid++
        } else {
          invoicesSummary.partial++
        }
        invoicesSummary.totalAmount += inv.amount
        invoicesSummary.totalPaid += totalPaid
      })

      // Residents
      residentsSummary.total += unit.residents.length
      residentsSummary.activeTickets += unit.tickets.filter(t => t.status !== "DONE").length
      residentsSummary.pendingDeliveries += unit.deliveryOrders.filter(d => d.status !== "DELIVERED").length
    })

    const remainingBalance = invoicesSummary.totalAmount - invoicesSummary.totalPaid

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        type: project.projectType?.name ?? null,
        isActive: project.isActive,
        unitCount: units.length
      },
      residents: residentsSummary,
      tickets: ticketsSummary,
      deliveries: deliveriesSummary,
      expenseNotes: expenseNotesSummary,
      technicianWork: technicianWorkSummary,
      staffPayroll: staffPayrollSummary,
      invoices: invoicesSummary,
      remainingBalance,
      totalOperationalCosts: technicianWorkSummary.totalCost + staffPayrollSummary.totalCost,
      totalCostsPaid: technicianWorkSummary.paidAmount + staffPayrollSummary.paidAmount,
      totalCostsUnpaid: technicianWorkSummary.unpaidAmount + staffPayrollSummary.unpaidAmount
    })
  } catch (error) {
    console.error("Error fetching project summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch project summary", details: String(error) },
      { status: 500 }
    )
  }
}
