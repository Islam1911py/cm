import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const staffId = searchParams.get("staffId")

    const where: any = {}
    if (projectId) where.projectId = projectId
    if (staffId) where.staffId = staffId

    if (session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const assignedProjects = session.user.projectIds || []

      if (projectId && !assignedProjects.includes(projectId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (assignedProjects.length === 0) {
        return NextResponse.json([])
      }

      where.projectId = projectId ? projectId : { in: assignedProjects }
    }

    const advances = await db.pMAdvance.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
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
      },
      orderBy: { createdAt: "desc" }
    })

    // Transform to include spending breakdown
    const advancesWithBreakdown = advances.map((advance) => {
      const unitExpensesTotal = advance.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0
      const operationalExpensesTotal =
        advance.operationalExpenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0
      const totalSpent = unitExpensesTotal + operationalExpensesTotal

      return {
        ...advance,
        totalSpent,
        spendingBreakdown: {
          unitExpenses: unitExpensesTotal,
          operationalExpenses: operationalExpensesTotal
        },
        percentageUsed: (totalSpent / advance.amount) * 100,
        percentageRemaining: (advance.remainingAmount / advance.amount) * 100
      }
    })

    return NextResponse.json(advancesWithBreakdown)
  } catch (error) {
    console.error("Error fetching PM Advances:", error)
    return NextResponse.json(
      { error: "Failed to fetch PM Advances", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { staffId, projectId, amount, notes } = await request.json()

    if (!staffId || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Missing required fields: staffId, amount" },
        { status: 400 }
      )
    }

    const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount)

    if (Number.isNaN(parsedAmount)) {
      return NextResponse.json({ error: "Amount must be a valid number" }, { status: 400 })
    }

    if (parsedAmount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 })
    }

    // Verify staff exists
    const staff = await db.staff.findUnique({
      where: { id: staffId }
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    // Verify project exists if provided
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId }
      })

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
    }

    // Create advance entry
    const advance = await db.pMAdvance.create({
      data: {
        staffId,
        projectId: projectId || null,
        amount: parsedAmount,
        remainingAmount: parsedAmount,
        notes: notes || null
      },
      include: {
        staff: {
          select: { id: true, name: true }
        },
        project: true
      }
    })

    return NextResponse.json(
      {
        message: "PM Advance created successfully",
        advance
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating PM Advance:", error)
    return NextResponse.json(
      { error: "Failed to create PM Advance", details: String(error) },
      { status: 500 }
    )
  }
}
