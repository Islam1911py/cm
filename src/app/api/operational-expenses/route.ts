import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { unitId, description, amount, sourceType, pmAdvanceId } = await request.json()

    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "ACCOUNTANT" &&
      session.user.role !== "PROJECT_MANAGER"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!unitId || !description || !amount || !sourceType) {
      return NextResponse.json(
        { error: "Missing required fields: unitId, description, amount, sourceType" },
        { status: 400 }
      )
    }

    const normalizedDescription = String(description).trim()
    const numericAmount = Number(amount)

    if (!normalizedDescription || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "Description must be provided and amount must be greater than zero" },
        { status: 400 }
      )
    }

    if (sourceType !== "OFFICE_FUND" && sourceType !== "PM_ADVANCE") {
      return NextResponse.json(
        { error: "Invalid sourceType. Must be OFFICE_FUND or PM_ADVANCE" },
        { status: 400 }
      )
    }

    if (sourceType === "PM_ADVANCE" && !pmAdvanceId) {
      return NextResponse.json(
        { error: "pmAdvanceId is required when sourceType is PM_ADVANCE" },
        { status: 400 }
      )
    }

    // Verify unit exists
    const unit = await db.operationalUnit.findUnique({
      where: { id: unitId }
    })

    if (!unit) {
      console.error("Unit not found for unitId:", unitId)
      return NextResponse.json({ error: "Operational unit not found" }, { status: 404 })
    }

    // Verify project exists for the unit
    const project = await db.project.findUnique({
      where: { id: unit.projectId }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found for this unit" }, { status: 404 })
    }

    if (session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const assignedProjects = session.user.projectIds || []
      if (!assignedProjects.includes(project.id)) {
        return NextResponse.json({ error: "Unauthorized for this project" }, { status: 403 })
      }
    }

    if (sourceType === "PM_ADVANCE" && pmAdvanceId) {
      const pmAdvanceRecord = await db.pMAdvance.findUnique({
        where: { id: pmAdvanceId },
        include: {
          staff: {
            select: { id: true, name: true }
          }
        }
      })

      if (!pmAdvanceRecord) {
        return NextResponse.json({ error: "PM Advance not found" }, { status: 404 })
      }
    }

    console.log("✓ Unit found:", unit.id, unit.name)

    // Instead of creating an invoice, create an ACCOUNTING NOTE
    // The accountant will review and record it
    const accountingNote = await db.accountingNote.create({
      data: {
        project: { connect: { id: unit.projectId } },
        unit: { connect: { id: unitId } },
        createdByUser: { connect: { id: session.user.id } },
        description: normalizedDescription,
        amount: numericAmount,
        status: "PENDING",
        sourceType,
        pmAdvance:
          sourceType === "PM_ADVANCE" && pmAdvanceId
            ? { connect: { id: pmAdvanceId } }
            : undefined
      },
      include: {
        project: true,
        unit: true,
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        pmAdvance: {
          include: {
            staff: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    console.log("✓ Accounting note created:", accountingNote.id)

    return NextResponse.json({
      success: true,
      message: "Operational expense recorded as accounting note. Waiting for accountant review.",
      accountingNote
    })
  } catch (error) {
    console.error("Error creating operational expense:", error)
    return NextResponse.json(
      { error: "Failed to create operational expense", details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get("unitId")
    const pmAdvanceId = searchParams.get("pmAdvanceId")
    const sourceType = searchParams.get("sourceType")
    const projectId = searchParams.get("projectId")

    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "ACCOUNTANT" &&
      session.user.role !== "PROJECT_MANAGER"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const conditions: any[] = []
    if (unitId) conditions.push({ unitId })
    if (pmAdvanceId) conditions.push({ pmAdvanceId })
    if (sourceType) conditions.push({ sourceType })
    if (projectId) {
      conditions.push({ unit: { projectId } })
    }

    if (session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const assignedProjects = session.user.projectIds || []
      if (projectId && !assignedProjects.includes(projectId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (assignedProjects.length === 0) {
        return NextResponse.json([])
      }

      conditions.push({
        OR: [
          { recordedByUserId: session.user.id },
          { unit: { projectId: { in: assignedProjects } } }
        ]
      })
    }

    const where = conditions.length > 0 ? { AND: conditions } : undefined

    const expenses = await db.operationalExpense.findMany({
      where,
      include: {
        unit: true,
        pmAdvance: true,
        claimInvoice: true,
        recordedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { recordedAt: "desc" }
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("Error fetching operational expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch operational expenses", details: String(error) },
      { status: 500 }
    )
  }
}
