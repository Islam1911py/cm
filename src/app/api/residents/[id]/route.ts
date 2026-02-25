import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/residents/[id] - Get resident details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resident = await db.resident.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            project: true
          }
        },
        tickets: true,
        deliveryOrders: true
      }
    })

    if (!resident) {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 })
    }

    return NextResponse.json(resident)
  } catch (error) {
    console.error("Error fetching resident:", error)
    return NextResponse.json({ error: "Failed to fetch resident" }, { status: 500 })
  }
}

// PUT /api/residents/[id] - Update resident
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, phone, address, status } = body

    const resident = await db.resident.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(status && { status })
      },
      include: {
        unit: {
          include: {
            project: true
          }
        }
      }
    })

    return NextResponse.json(resident)
  } catch (error) {
    console.error("Error updating resident:", error)
    return NextResponse.json({ error: "Failed to update resident" }, { status: 500 })
  }
}

// DELETE /api/residents/[id] - Delete resident
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryOrder.deleteMany({ where: { residentId: id } })
      await tx.ticket.updateMany({
        where: { residentId: id },
        data: {
          residentId: null,
          isResidentKnown: false
        }
      })

      await tx.resident.delete({ where: { id } })
    })

    return NextResponse.json({ message: "Resident deleted" })
  } catch (error) {
    console.error("Error deleting resident:", error)
    return NextResponse.json({ error: "Failed to delete resident" }, { status: 500 })
  }
}
