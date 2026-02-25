import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/technician-payments - List all payments or filter by technician
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const technicianId = searchParams.get("technicianId")

    const whereClause: any = technicianId ? { technicianId } : {}

    const payments = await db.technicianPayment.findMany({
      where: whereClause,
      include: {
        technician: {
          select: { id: true, name: true, phone: true, specialty: true }
        }
      },
      orderBy: { paidAt: "desc" as const }
    })

    // Enrich payments with work details
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        let work = await db.technicianWork.findFirst({
          where: { technicianId: payment.technicianId, paidAt: payment.paidAt },
          include: {
            unit: {
              include: { project: true }
            }
          }
        })

        if (!work) {
          work = await db.technicianWork.findFirst({
            where: { technicianId: payment.technicianId },
            include: {
              unit: {
                include: { project: true }
              }
            },
            orderBy: [{ paidAt: "desc" as const }, { createdAt: "desc" as const }]
          })
        }
        return {
          ...payment,
          work: work || null
        }
      })
    )

    return NextResponse.json(enrichedPayments)
  } catch (error) {
    console.error("Error fetching technician payments:", error)
    return NextResponse.json({ error: "Failed to fetch technician payments" }, { status: 500 })
  }
}

// POST /api/technician-payments - Create payment (link to work records)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { technicianId, amount, notes, workIds } = body

    if (!technicianId || !amount) {
      return NextResponse.json({ error: "technicianId and amount are required" }, { status: 400 })
    }

    if (!workIds || workIds.length === 0) {
      return NextResponse.json({ error: "At least one work ID is required" }, { status: 400 })
    }

    // Create payment records for selected work
    const paymentDate = new Date()
    const payments = await Promise.all(
      workIds.map((workId: string) =>
        db.technicianPayment.create({
          data: {
            technicianId,
            amount: parseFloat(amount),
            notes: notes || null,
            paidAt: paymentDate
          }
        })
      )
    )

    // Mark all selected work as paid
    await db.technicianWork.updateMany({
      where: {
        id: { in: workIds }
      },
      data: {
        isPaid: true,
        paidAt: paymentDate
      }
    })

    return NextResponse.json({ 
      message: `Created ${workIds.length} payment(s)`,
      payments
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating technician payments:", error)
    return NextResponse.json({ error: "Failed to create technician payments" }, { status: 500 })
  }
}

// PUT /api/technician-payments/[id] - Update payment notes
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { notes } = body

    const payment = await db.technicianPayment.findUnique({
      where: { id: params.id }
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    await db.technicianPayment.update({
      where: { id: params.id },
      data: { notes }
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error("Error updating technician payment:", error)
    return NextResponse.json({ error: "Failed to update technician payment" }, { status: 500 })
  }
}
