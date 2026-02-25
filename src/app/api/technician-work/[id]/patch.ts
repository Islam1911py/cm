import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH /api/technician-work/[id] - Update work status (start/complete)
// Body: { action: "start" | "complete", description?, amount? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT" && session.user.role !== "PROJECT_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { action, description, amount } = body

    if (!action || !["start", "complete"].includes(action)) {
      return NextResponse.json({ error: "action must be 'start' or 'complete'" }, { status: 400 })
    }

    // Get current work record
    const work = await db.technicianWork.findUnique({
      where: { id: params.id },
      include: {
        unit: {
          include: {
            project: true
          }
        }
      }
    })

    if (!work) {
      return NextResponse.json({ error: "Work record not found" }, { status: 404 })
    }

    // Verify authorization for PROJECT_MANAGER
    if (session.user.role === "PROJECT_MANAGER") {
      const assignment = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true }
      })
      const projectIds = assignment.map(a => a.projectId)
      
      if (!projectIds.includes(work.unit.projectId)) {
        return NextResponse.json({ error: "Unauthorized: Unit not in your assigned projects" }, { status: 403 })
      }
    }

    // Handle different actions
    if (action === "start") {
      // Move from PENDING to IN_PROGRESS
      const updated = await db.technicianWork.update({
        where: { id: params.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date()
        },
        include: {
          technician: true,
          unit: {
            include: {
              project: true
            }
          }
        }
      })
      return NextResponse.json(updated)
    }

    if (action === "complete") {
      // Move from IN_PROGRESS to COMPLETED with description and amount
      if (!description || !amount) {
        return NextResponse.json({ error: "description and amount are required to complete work" }, { status: 400 })
      }

      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return NextResponse.json({ error: "amount must be a valid positive number" }, { status: 400 })
      }

      const parsedAmount = parseFloat(amount)

      // Update work record
      const updated = await db.technicianWork.update({
        where: { id: params.id },
        data: {
          status: "COMPLETED",
          description: description.trim(),
          amount: parsedAmount,
          completedAt: new Date()
        },
        include: {
          technician: true,
          unit: {
            include: {
              project: true
            }
          }
        }
      })

      // 1. Create Technician Payment (for the technician's salary)
      await db.technicianPayment.create({
        data: {
          technicianId: updated.technicianId,
          amount: parsedAmount,
          notes: `${updated.unit.name} - ${description}`,
          paidAt: new Date()
        }
      })

      // 2. Add to Unit's Expenses (for the unit's invoice)
      await db.accountingNote.create({
        data: {
          amount: parsedAmount,
          description: `عمل تقني بواسطة ${updated.technician.name}: ${description.trim()}`,
          status: "PENDING", // Will be reviewed by accountant
          unitId: work.unitId,
          projectId: updated.unit.projectId,
          createdByUserId: session.user.id
        }
      })

      return NextResponse.json(updated)
    }
  } catch (error) {
    console.error("Error updating technician work:", error)
    return NextResponse.json({ error: "Failed to update work record" }, { status: 500 })
  }
}
