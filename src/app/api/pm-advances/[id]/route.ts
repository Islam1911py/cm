import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

function formatAdvanceResponse(advance: any) {
  const unitExpensesTotal = advance.expenses?.reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0) || 0
  const operationalExpensesTotal =
    advance.operationalExpenses?.reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0) || 0
  const totalSpent = unitExpensesTotal + operationalExpensesTotal

  return {
    ...advance,
    totalSpent,
    spendingBreakdown: {
      unitExpenses: unitExpensesTotal,
      operationalExpenses: operationalExpensesTotal
    },
    percentageUsed: advance.amount === 0 ? 0 : (totalSpent / advance.amount) * 100,
    percentageRemaining: advance.amount === 0 ? 0 : (advance.remainingAmount / advance.amount) * 100
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = params
    const { amount, projectId, notes } = await request.json()

    if (amount === undefined && projectId === undefined && notes === undefined) {
      return NextResponse.json({ error: "No fields provided for update" }, { status: 400 })
    }

    const advance = await db.pMAdvance.findUnique({
      where: { id }
    })

    if (!advance) {
      return NextResponse.json({ error: "PM Advance not found" }, { status: 404 })
    }

    const totalSpent = Number((advance.amount - advance.remainingAmount).toFixed(2))
    const data: Record<string, unknown> = {}

    if (amount !== undefined) {
      const normalizedAmount = Number(amount)

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 })
      }

      data.amount = normalizedAmount
      const newRemaining = Number((normalizedAmount - totalSpent).toFixed(2))
      data.remainingAmount = newRemaining
    }

    if (projectId !== undefined) {
      if (projectId === null || projectId === "") {
        data.projectId = null
      } else {
        const projectExists = await db.project.findUnique({ where: { id: String(projectId) } })

        if (!projectExists) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 })
        }

        data.projectId = String(projectId)
      }
    }

    if (notes !== undefined) {
      if (notes === null) {
        data.notes = null
      } else {
        const normalizedNotes = String(notes).trim()
        data.notes = normalizedNotes.length > 0 ? normalizedNotes : null
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 })
    }

    const updatedAdvance = await db.pMAdvance.update({
      where: { id },
      data,
      include: {
        staff: {
          select: { id: true, name: true }
        },
        project: true,
        expenses: {
          include: {
            unit: true
          }
        },
        operationalExpenses: {
          include: {
            unit: true
          }
        }
      }
    })

    return NextResponse.json({
      message: "PM Advance updated successfully",
      advance: formatAdvanceResponse(updatedAdvance)
    })
  } catch (error) {
    console.error("Error updating PM Advance:", error)
    return NextResponse.json(
      { error: "Failed to update PM Advance", details: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = params

    const advance = await db.pMAdvance.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            expenses: true,
            operationalExpenses: true,
            accountingNotes: true
          }
        }
      }
    })

    if (!advance) {
      return NextResponse.json({ error: "PM Advance not found" }, { status: 404 })
    }

    if (advance._count.expenses > 0 || advance._count.operationalExpenses > 0 || advance._count.accountingNotes > 0) {
      return NextResponse.json(
        { error: "Cannot delete advance that has related expenses or notes" },
        { status: 400 }
      )
    }

    await db.pMAdvance.delete({ where: { id } })

    return NextResponse.json({ message: "PM Advance deleted successfully" })
  } catch (error) {
    console.error("Error deleting PM Advance:", error)
    return NextResponse.json(
      { error: "Failed to delete PM Advance", details: String(error) },
      { status: 500 }
    )
  }
}
