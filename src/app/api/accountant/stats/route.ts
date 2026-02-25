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

    if (role !== "ADMIN" && role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get financial statistics
    const [
      monthlyInvoices,
      claimInvoices,
      totalPayments,
      pendingNotes,
      outstanding,
      staffSalaries
    ] = await Promise.all([
      // Monthly Service Invoices
      db.invoice.count({
        where: { type: "MANAGEMENT_SERVICE" }
      }),
      
      // Claim Invoices
      db.invoice.count({
        where: { type: "CLAIM" }
      }),
      
      // Total Payments
      db.payment.count(),
      
      // Pending Accounting Notes
      db.accountingNote.count({
        where: { status: "PENDING" }
      }),
      
      // Outstanding amount (sum of unpaid invoices)
      db.invoice.aggregate({
        where: {
          remainingBalance: { gt: 0 }
        },
        _sum: { remainingBalance: true }
      }),
      
      // Total Staff Salaries
      db.staff.aggregate({
        where: { status: "ACTIVE" },
        _sum: { salary: true }
      })
    ])

    return NextResponse.json({
      totalMonthlyInvoices: monthlyInvoices,
      totalClaimInvoices: claimInvoices,
      totalPayments: totalPayments,
      pendingAccountingNotes: pendingNotes,
      outstandingAmount: outstanding._sum?.remainingBalance ?? 0,
      totalStaffSalaries: staffSalaries._sum?.salary ?? 0
    })
  } catch (error) {
    console.error("Error fetching financial stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch financial statistics" },
      { status: 500 }
    )
  }
}
