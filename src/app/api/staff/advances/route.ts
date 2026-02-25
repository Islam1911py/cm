import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get("staffId")
    const statusParam = searchParams.get("status")
    const normalizedStatus = statusParam && ["PENDING", "DEDUCTED"].includes(statusParam)
      ? statusParam
      : undefined

    // @ts-ignore - النموذج موجود في Prisma
    const advances = await db.staffAdvance.findMany({
      where: {
        ...(staffId ? { staffId } : {}),
        ...(normalizedStatus ? { status: normalizedStatus } : {})
      },
      include: {
        staff: {
          select: { name: true }
        }
      },
      orderBy: {
        date: "desc"
      }
    })

    return NextResponse.json(advances)
  } catch (error) {
    console.error("[STAFF_ADVANCES_GET]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { staffId, amount, note } = await req.json()

    if (!staffId || !amount) {
      return NextResponse.json(
        { error: "Staff ID and amount are required" },
        { status: 400 }
      )
    }

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

    // @ts-ignore - النموذج موجود في Prisma
    const advance = await db.staffAdvance.create({
      data: {
        staffId,
        amount: parseFloat(amount),
        note,
        status: "PENDING",
        date: new Date()
      },
      include: {
        staff: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json(advance, { status: 201 })
  } catch (error) {
    console.error("[STAFF_ADVANCES_POST]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
