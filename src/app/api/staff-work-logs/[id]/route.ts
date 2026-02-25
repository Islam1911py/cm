import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

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
    const { description, amount, workDate, isPaid } = body

    const workLog = await db.staffWorkLog.update({
      where: { id },
      data: {
        ...(description && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(workDate && { workDate: new Date(workDate) }),
        ...(isPaid !== undefined && { isPaid }),
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

    return NextResponse.json(workLog)
  } catch (error) {
    console.error("Error updating work log:", error)
    return NextResponse.json(
      { error: "Failed to update work log" },
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

    await db.staffWorkLog.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting work log:", error)
    return NextResponse.json(
      { error: "Failed to delete work log" },
      { status: 500 }
    )
  }
}
