import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const staffId = searchParams.get("staffId")
  const unitId = searchParams.get("unitId")
  const isPaid = searchParams.get("isPaid")

  try {
    const where: any = {}
    if (staffId) where.staffId = staffId
    if (unitId) where.unitId = unitId
    if (isPaid !== null) where.isPaid = isPaid === "true"

    const workLogs = await db.staffWorkLog.findMany({
      where,
      include: {
        staff: true,
        unit: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { workDate: "desc" },
    })

    return NextResponse.json(workLogs)
  } catch (error) {
    console.error("Error fetching work logs:", error)
    return NextResponse.json({ error: "Failed to fetch work logs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "ACCOUNTANT")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { staffId, unitId, description, amount, workDate } = body

    if (!staffId || !unitId || !description || !amount || !workDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify that the staff member is a field worker
    const staff = await db.staff.findUnique({
      where: { id: staffId },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    if (staff.type !== "FIELD_WORKER") {
      return NextResponse.json(
        { error: "Only field workers can have work logs" },
        { status: 400 }
      )
    }

    const workLog = await db.staffWorkLog.create({
      data: {
        staffId,
        unitId,
        description,
        amount: parseFloat(amount as string),
        workDate: new Date(workDate),
      },
      include: {
        staff: true,
        unit: {
          include: {
            project: true,
          },
        },
      },
    })

    return NextResponse.json(workLog, { status: 201 })
  } catch (error) {
    console.error("Error creating work log:", error)
    return NextResponse.json(
      { error: "Failed to create work log" },
      { status: 500 }
    )
  }
}
