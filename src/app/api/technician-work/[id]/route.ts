import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH - Update work (start or complete)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PROJECT_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, amount, description } = body

    if (action === "start") {
      // Start work: PENDING → IN_PROGRESS
      const updated = await db.technicianWork.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      })

      return NextResponse.json(updated)
    }

    if (action === "complete") {
      // Complete work: IN_PROGRESS → COMPLETED
      if (!amount || !description) {
        return NextResponse.json({ error: "amount and description required" }, { status: 400 })
      }

      // Get work details
      const work = await db.technicianWork.findUnique({
        where: { id },
        include: { unit: true },
      })

      if (!work) {
        return NextResponse.json({ error: "Work not found" }, { status: 404 })
      }

      // Update work
      const updated = await db.technicianWork.update({
        where: { id },
        data: {
          status: "COMPLETED",
          amount: parseFloat(amount),
          description,
          completedAt: new Date(),
        },
      })

      // Create TechnicianPayment (فلوس للعامل)
      await db.technicianPayment.create({
        data: {
          technicianId: work.technicianId,
          amount: parseFloat(amount),
          notes: description,
          paidAt: new Date(),
        },
      })

      // Create AccountingNote (فاتورة للعمارة)
      await db.accountingNote.create({
        data: {
          projectId: work.unit.projectId,
          unitId: work.unitId,
          createdByUserId: session.user.id,
          description,
          amount: parseFloat(amount),
          status: "PENDING",
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating work:", error)
    return NextResponse.json({ error: "Failed to update work" }, { status: 500 })
  }
}

// DELETE - Delete work
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PROJECT_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    await db.technicianWork.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting work:", error)
    return NextResponse.json({ error: "Failed to delete work" }, { status: 500 })
  }
}
