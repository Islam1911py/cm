import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const staff = await db.staff.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            project: true,
          },
        },
        workLogs: {
          orderBy: { workDate: "desc" },
        },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Error fetching staff:", error)
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "ACCOUNTANT")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { name, type, role, phone, salary, status, unitId } = body

    // Validate staff type if provided
    if (type && !["OFFICE_STAFF", "FIELD_WORKER"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid staff type" },
        { status: 400 }
      )
    }

    // Validate that OFFICE_STAFF has a salary
    if (type === "OFFICE_STAFF" && !salary) {
      return NextResponse.json(
        { error: "Salary is required for office staff" },
        { status: 400 }
      )
    }

    const staff = await db.staff.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(role && { role }),
        ...(phone !== undefined && { phone }),
        ...(salary !== undefined && {
          salary: type === "OFFICE_STAFF" ? parseFloat(salary) : null,
        }),
        ...(status && { status }),
        ...(unitId && { unitId }),
      },
      include: {
        unit: {
          include: {
            project: true,
          },
        },
        workLogs: {
          orderBy: { workDate: "desc" },
        },
      },
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Error updating staff:", error)
    return NextResponse.json(
      { error: "Failed to update staff" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "ACCOUNTANT")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    await db.staff.update({
      where: { id },
      data: { status: "INACTIVE" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting staff:", error)
    return NextResponse.json(
      { error: "Failed to delete staff" },
      { status: 500 }
    )
  }
}
