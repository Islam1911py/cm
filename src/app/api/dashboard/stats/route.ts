import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]

    // Base where clause based on role
    let projectWhere: any = {}
    let unitWhere: any = {}
    if (role === "PROJECT_MANAGER") {
      projectWhere = {
        id: { in: projectIds }
      }
      unitWhere = {
        project: projectWhere
      }
    }

    // Get statistics
    const [
      totalProjects,
      totalUnits,
      totalResidents,
      totalTickets,
      newTickets,
      inProgressTickets,
      doneTickets,
      totalDeliveryOrders,
      newOrders,
      inProgressOrders,
      deliveredOrders,
      totalInvoices,
      totalPayments,
      pendingAccountingNotes,
      totalStaff,
      activeStaff
    ] = await Promise.all([
      // Projects
      db.project.count({
        where: projectWhere
      }),

      // Operational Units
      db.operationalUnit.count({
        where: unitWhere
      }),

      // Residents - filtered by unit's project
      db.resident.count({
        where: role === "PROJECT_MANAGER"
          ? {
              unit: unitWhere
            }
          : undefined
      }),

      // Total Tickets
      db.ticket.count({
        where: role === "PROJECT_MANAGER"
          ? {
              unit: unitWhere
            }
          : undefined
      }),

      // New Tickets
      db.ticket.count({
        where: {
          ...(role === "PROJECT_MANAGER" ? { unit: unitWhere } : {}),
          status: "NEW"
        }
      }),

      // In Progress Tickets
      db.ticket.count({
        where: {
          ...(role === "PROJECT_MANAGER" ? { unit: unitWhere } : {}),
          status: "IN_PROGRESS"
        }
      }),

      // Done Tickets
      db.ticket.count({
        where: {
          ...(role === "PROJECT_MANAGER" ? { unit: unitWhere } : {}),
          status: "DONE"
        }
      }),

      // Total Delivery Orders
      db.deliveryOrder.count({
        where: role === "PROJECT_MANAGER"
          ? {
              unit: unitWhere
            }
          : undefined
      }),

      // New Orders
      db.deliveryOrder.count({
        where: {
          ...(role === "PROJECT_MANAGER" ? { unit: unitWhere } : {}),
          status: "NEW"
        }
      }),

      // In Progress Orders
      db.deliveryOrder.count({
        where: {
          ...(role === "PROJECT_MANAGER" ? { unit: unitWhere } : {}),
          status: "IN_PROGRESS"
        }
      }),

      // Delivered Orders
      db.deliveryOrder.count({
        where: {
          ...(role === "PROJECT_MANAGER" ? { unit: unitWhere } : {}),
          status: "DELIVERED"
        }
      }),

      // Total Invoices
      db.invoice.count({
        where: role === "PROJECT_MANAGER"
          ? {
              unit: unitWhere
            }
          : undefined
      }),

      // Total Payments
      db.payment.count(),

      // Pending Accounting Notes
      db.accountingNote.count({
        where: {
          status: "PENDING",
          ...(role === "PROJECT_MANAGER"
            ? {
                OR: [
                  { createdByUserId: session.user.id },
                  { projectId: { in: projectIds } }
                ]
              }
            : {})
        }
      }),

      // Total Staff
      db.staff.count({
        where: role === "PROJECT_MANAGER"
          ? {
              unit: unitWhere
            }
          : undefined
      }),

      // Active Staff
      db.staff.count({
        where: {
          ...(role === "PROJECT_MANAGER" ? { unit: unitWhere } : {}),
          status: "ACTIVE"
        }
      })
    ])

    return NextResponse.json({
      projects: totalProjects,
      operationalUnits: totalUnits,
      residents: totalResidents,
      tickets: {
        total: totalTickets,
        new: newTickets,
        inProgress: inProgressTickets,
        done: doneTickets
      },
      deliveryOrders: {
        total: totalDeliveryOrders,
        new: newOrders,
        inProgress: inProgressOrders,
        delivered: deliveredOrders
      },
      invoices: totalInvoices,
      payments: totalPayments,
      pendingAccountingNotes,
      staff: {
        total: totalStaff,
        active: activeStaff
      }
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    )
  }
}
