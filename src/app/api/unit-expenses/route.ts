import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"

// GET /api/unit-expenses - List expenses for a unit
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const unitId = searchParams.get("unitId")
    const projectId = searchParams.get("projectId")

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit ID is required" },
        { status: 400 }
      )
    }

    // Get unit and verify access
    const unit = await prisma.operationalUnit.findUnique({
      where: { id: unitId },
      include: { project: true }
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Check project access
    if (session.user.role === "PROJECT_MANAGER") {
      const assignment = await prisma.projectAssignment.findFirst({
        where: {
          userId: session.user.id,
          projectId: unit.projectId
        }
      })

      if (!assignment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Fetch expenses for this unit
    const expenses = await prisma.unitExpense.findMany({
      where: { unitId },
      include: {
        unit: true,
        recordedByUser: { select: { id: true, name: true } },
        technicianWork: { include: { technician: true } },
        staffWorkLog: { include: { staff: true } },
        claimInvoice: true
      },
      orderBy: { date: "desc" }
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("Error fetching unit expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch unit expenses" },
      { status: 500 }
    )
  }
}

// POST /api/unit-expenses - Create expense directly
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { unitId, pmAdvanceId, description, amount, sourceType } = body

    if (!unitId || !pmAdvanceId || !description || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify unit exists
    const unit = await prisma.operationalUnit.findUnique({
      where: { id: unitId }
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Verify PM Advance exists and is for the unit's project
    const pmAdvance = await prisma.pMAdvance.findUnique({
      where: { id: pmAdvanceId }
    })

    if (!pmAdvance) {
      return NextResponse.json(
        { error: "PM Advance not found" },
        { status: 404 }
      )
    }

    if (pmAdvance.projectId !== unit.projectId) {
      return NextResponse.json(
        { error: "PM Advance does not belong to this unit's project" },
        { status: 400 }
      )
    }

    // Create expense
    const expense = await (prisma.unitExpense.create as any)({
      data: {
        unitId,
        pmAdvanceId: pmAdvanceId || null,
        date: new Date(),
        description,
        amount: parseFloat(amount),
        sourceType: sourceType || "OTHER",
        recordedByUserId: session.user.id
      },
      include: {
        unit: true,
        recordedByUser: { select: { id: true, name: true } }
      }
    })

    // Update PM Advance remaining amount
    const newRemaining = pmAdvance.remainingAmount - parseFloat(amount)
    await prisma.pMAdvance.update({
      where: { id: pmAdvanceId },
      data: { remainingAmount: Math.max(0, newRemaining) }
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error("Error creating unit expense:", error)
    return NextResponse.json(
      { error: "Failed to create unit expense" },
      { status: 500 }
    )
  }
}
