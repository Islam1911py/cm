import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * Fix invoice calculations - recalculate totalPaid, remainingBalance, and isPaid for all invoices
 * This endpoint should only be accessible to ADMIN users
 * Method: GET to check status, POST to fix
 */

/**
 * GET endpoint to view current invoice status
 * Returns analysis of all invoices with potential mismatches
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Check authorization
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Only admin can access this endpoint" },
        { status: 403 }
      )
    }

    // Get all invoices
    const invoices = await db.invoice.findMany({
      include: { payments: true },
      orderBy: { issuedAt: "desc" }
    })

    // Analyze each invoice
    const analysis = invoices.map(inv => {
      const totalFromPayments = inv.payments.reduce((sum, p) => sum + p.amount, 0)
      const storedTotal = inv.totalPaid || 0
      const discrepancy = Math.abs(totalFromPayments - storedTotal)

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        totalPaid: storedTotal,
        totalFromPayments,
        remainingBalance: inv.remainingBalance,
        isPaid: inv.isPaid,
        discrepancy: discrepancy > 0.01 ? "⚠️ MISMATCH" : "✓",
        paymentCount: inv.payments.length
      }
    })

    // Find problems
    const problems = analysis.filter(a => a.discrepancy === "⚠️ MISMATCH")

    return NextResponse.json({
      totalInvoices: invoices.length,
      problemInvoices: problems.length,
      analysis,
      problems
    })
  } catch (error) {
    console.error("Error analyzing invoices:", error)
    return NextResponse.json(
      { error: "Failed to analyze invoices" },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint to fix invoice calculations
 * Recalculates totalPaid, remainingBalance, and isPaid based on payments
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Only admin can fix invoices
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Only admin can fix invoices" },
        { status: 403 }
      )
    }

    // Get all invoices with their payments
    const invoices = await db.invoice.findMany({
      include: { payments: true }
    })

    let fixedCount = 0
    let totalAmount = 0

    for (const invoice of invoices) {
      // Calculate total paid from payments
      const totalPaidFromPayments = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
      
      // Round to 2 decimals
      const roundedTotalPaid = Math.round(totalPaidFromPayments * 100) / 100
      const roundedRemaining = Math.round((invoice.amount - roundedTotalPaid) * 100) / 100
      const isPaid = roundedRemaining <= 0.01

      // Check if anything needs to be updated
      if (
        invoice.totalPaid !== roundedTotalPaid ||
        invoice.remainingBalance !== roundedRemaining ||
        invoice.isPaid !== isPaid
      ) {
        totalAmount += invoice.amount
        fixedCount++

        // Update invoice
        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            totalPaid: roundedTotalPaid,
            remainingBalance: roundedRemaining,
            isPaid
          }
        })

        console.log(`Fixed invoice ${invoice.invoiceNumber}:`)
        console.log(`  - Old: totalPaid=${invoice.totalPaid}, remaining=${invoice.remainingBalance}, isPaid=${invoice.isPaid}`)
        console.log(`  - New: totalPaid=${roundedTotalPaid}, remaining=${roundedRemaining}, isPaid=${isPaid}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} invoices`,
      totalInvoices: invoices.length,
      fixedInvoices: fixedCount,
      totalAmount: totalAmount.toFixed(2)
    })
  } catch (error) {
    console.error("Error fixing invoices:", error)
    return NextResponse.json(
      { error: "Failed to fix invoices", details: String(error) },
      { status: 500 }
    )
  }
}

