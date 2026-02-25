import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/unit-expenses/[unitId] - Get expenses (accounting notes) for a specific unit
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { unitId } = await params

    // Get the unit to verify it exists
    const unit = await db.operationalUnit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        name: true,
        code: true,
        project: {
          select: { id: true, name: true }
        }
      }
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Get all accounting notes (expenses) for this unit
    const expenses = await db.accountingNote.findMany({
      where: { unitId },
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    // Calculate totals
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const recordedExpenses = expenses.filter(e => e.status === "CONVERTED")
    const recordedTotal = recordedExpenses.reduce((sum, e) => sum + e.amount, 0)
    const pendingTotal = totalExpenses - recordedTotal

    return NextResponse.json({
      unit,
      expenses,
      summary: {
        totalExpenses,
        convertedExpenses: recordedExpenses.length,
        convertedTotal: recordedTotal,
        pendingTotal,
        pendingExpenses: expenses.filter(e => e.status === "PENDING").length
      }
    })
  } catch (error) {
    console.error("Error fetching unit expenses:", error)
    return NextResponse.json({ error: "Failed to fetch unit expenses" }, { status: 500 })
  }
}
