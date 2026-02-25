import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const resolveParams = async (params: { id: string } | Promise<{ id: string }>) => {
  return typeof (params as any)?.then === "function" ? await params : params
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const resolved = await resolveParams(params)
    const advanceId = resolved?.id

    if (!advanceId || advanceId === "undefined") {
      return NextResponse.json({ error: "Advance ID is required" }, { status: 400 })
    }

    const advance = await db.staffAdvance.findUnique({
      where: { id: advanceId }
    })

    if (!advance) {
      return NextResponse.json(
        { error: "Advance not found" },
        { status: 404 }
      )
    }

    if (advance.status === "DEDUCTED") {
      return NextResponse.json(
        { error: "Cannot delete deducted advances" },
        { status: 400 }
      )
    }

    await db.staffAdvance.delete({
      where: { id: advanceId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[STAFF_ADVANCE_DELETE]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const resolved = await resolveParams(params)
    const advanceId = resolved?.id

    if (!advanceId || advanceId === "undefined") {
      return NextResponse.json({ error: "Advance ID is required" }, { status: 400 })
    }

    const body = await req.json()
    const { amount, note } = body

    if (amount === undefined && note === undefined) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      )
    }

    let parsedAmount: number | undefined
    if (amount !== undefined) {
      parsedAmount = typeof amount === "number" ? amount : parseFloat(amount)
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: "Amount must be greater than zero" },
          { status: 400 }
        )
      }
    }

    const advance = await db.staffAdvance.findUnique({
      where: { id: advanceId }
    })

    if (!advance) {
      return NextResponse.json(
        { error: "Advance not found" },
        { status: 404 }
      )
    }

    if (advance.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending advances can be edited" },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    if (parsedAmount !== undefined) {
      data.amount = parsedAmount
    }
    if (note !== undefined) {
      data.note = note
    }

    const updatedAdvance = await db.staffAdvance.update({
      where: { id: advanceId },
      data,
      include: {
        staff: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json(updatedAdvance)
  } catch (error) {
    console.error("[STAFF_ADVANCE_PATCH]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
