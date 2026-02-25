import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/technicians/[id]/work-summary - Get work breakdown for technician
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT" && session.user.role !== "PROJECT_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get technician with works and payments
    const technician = await db.technician.findUnique({
      where: { id },
      include: {
        works: {
          include: {
            unit: {
              include: {
                project: true
              }
            }
          }
        },
        payments: true
      }
    })

    if (!technician) {
      return NextResponse.json({ error: "Technician not found" }, { status: 404 })
    }

    // Calculate totals
    const totalEarned = technician.works.reduce((sum, work) => sum + (work.amount ?? 0), 0)
    const totalPaid = technician.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const totalPending = totalEarned - totalPaid

    // Group work by unit
    const workByUnit = new Map<string, any>()

    technician.works.forEach((work) => {
      const unitId = work.unit.id
      if (!workByUnit.has(unitId)) {
        workByUnit.set(unitId, {
          unitId,
          unitName: work.unit.name,
          projectId: work.unit.project.id,
          projectName: work.unit.project.name,
          totalJobs: 0,
          totalCost: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          jobs: []
        })
      }

      const unitData = workByUnit.get(unitId)
      unitData.totalJobs += 1
      unitData.totalCost += work.amount
      unitData.jobs.push({
        id: work.id,
        date: work.createdAt,
        description: work.description,
        amount: work.amount,
        isPaid: work.isPaid,
        paidAt: work.paidAt
      })
    })

    // Calculate paid amounts per unit based on payment dates
    // For simplicity, distribute total payments proportionally to each unit's work
    const unitArray = Array.from(workByUnit.values())

    if (totalEarned > 0) {
      unitArray.forEach((unitData) => {
        const unitPortion = unitData.totalCost / totalEarned
        unitData.paidAmount = totalPaid * unitPortion
        unitData.unpaidAmount = unitData.totalCost - unitData.paidAmount
      })
    }

    // Build work history timeline
    const allWorkAndPayments = [
      ...technician.works
        .filter((work) => work.unit)  // Filter out work without unit
        .map((work) => ({
          type: "work",
          date: work.createdAt,
          id: work.id,
          unit: {
            id: work.unit.id,
            name: work.unit.name
          },
          description: work.description,
          amount: work.amount,
          isPaid: work.isPaid
        })),
      ...technician.payments.map((payment) => ({
        type: "payment",
        date: payment.paidAt,
        id: payment.id,
        amount: payment.amount,
        notes: payment.notes
      }))
    ]

    // Sort by date descending
    allWorkAndPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      technician: {
        id: technician.id,
        name: technician.name,
        phone: technician.phone,
        specialty: technician.specialty
      },
      totals: {
        earned: totalEarned,
        paid: totalPaid,
        pending: totalPending
      },
      byUnit: unitArray,
      history: allWorkAndPayments
    })
  } catch (error) {
    console.error("Error fetching technician work summary:", error)
    return NextResponse.json({ error: "Failed to fetch work summary" }, { status: 500 })
  }
}
