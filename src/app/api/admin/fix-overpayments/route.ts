import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * Fix overpaid invoices by removing excess payments
 * Only fixes CLAIM invoices with overpayments
 * This is a maintenance endpoint for data cleanup
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Only admin can fix data
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Only admin can fix data" },
        { status: 403 }
      )
    }

    // Get all invoices with their payments
    const invoices = await db.invoice.findMany({
      include: { payments: true }
    })

    let deletedCount = 0
    const fixes: Array<{
      invoiceNumber: string
      amount: number
      totalPaid: number
      overpayment: number
      paymentCount: number
      action: string
    }> = []

    for (const invoice of invoices) {
      // Calculate total paid from payments
      const totalPaidFromPayments = invoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
      
      // Check if overpaid (more paid than invoice amount)
      if (totalPaidFromPayments > invoice.amount + 0.01) {
        // Only fix CLAIM invoices
        if (invoice.type === "CLAIM") {
          const overpaymentAmount = Math.round((totalPaidFromPayments - invoice.amount) * 100) / 100
          
          fixes.push({
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            totalPaid: totalPaidFromPayments,
            overpayment: overpaymentAmount,
            paymentCount: invoice.payments.length,
            action: "DELETE overpayment"
          })

          // Delete the last payment (which caused overpayment)
          const lastPayment = invoice.payments[invoice.payments.length - 1]
          if (lastPayment) {
            await db.payment.delete({
              where: { id: lastPayment.id }
            })
            deletedCount++
          }

          // Recalculate invoice totals
          const remainingPayments = invoice.payments.filter((p: any) => p.id !== lastPayment?.id)
          const newTotalPaid = Math.round(remainingPayments.reduce((sum: number, p: any) => sum + p.amount, 0) * 100) / 100
          const newRemaining = Math.round((invoice.amount - newTotalPaid) * 100) / 100
          const newIsPaid = newRemaining <= 0.01

          await db.invoice.update({
            where: { id: invoice.id },
            data: {
              totalPaid: newTotalPaid,
              remainingBalance: newRemaining,
              isPaid: newIsPaid
            }
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${deletedCount} overpaid invoices`,
      fixes
    })
  } catch (error) {
    console.error("Error fixing overpayments:", error)
    return NextResponse.json(
      { error: "Failed to fix overpayments", details: String(error) },
      { status: 500 }
    )
  }
}
