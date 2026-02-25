import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const staffId = params.id

    // Verify staff exists
    const staff = await db.staff.findUnique({
      where: { id: staffId }
    })

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      )
    }

    // Get all advances for this staff
    // @ts-ignore - النموذج موجود في Prisma
    const advances = await db.staffAdvance.findMany({
      where: { staffId },
      include: {
        payroll: {
          select: { id: true, month: true, status: true }
        }
      },
      orderBy: {
        date: "desc"
      }
    })

    // Calculate stats
    const pendingAmount = advances
      .filter(a => a.status === "PENDING")
      .reduce((sum, a) => sum + a.amount, 0)

    const deductedAmount = advances
      .filter(a => a.status === "DEDUCTED")
      .reduce((sum, a) => sum + a.amount, 0)

    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        salary: staff.salary
      },
      advances,
      stats: {
        pendingAmount,
        deductedAmount,
        totalAdvances: pendingAmount + deductedAmount
      }
    })
  } catch (error) {
    console.error("[STAFF_ADVANCES_GET]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
