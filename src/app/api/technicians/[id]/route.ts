import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/technicians/[id] - Get technician details
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

    return NextResponse.json(technician)
  } catch (error) {
    console.error("Error fetching technician:", error)
    return NextResponse.json({ error: "Failed to fetch technician" }, { status: 500 })
  }
}

// PUT /api/technicians/[id] - Update technician (Admin & Accountant only)
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, phone, specialty, notes } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(specialty !== undefined && { specialty }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date()
    }

    const technician = await db.technician.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(technician)
  } catch (error) {
    console.error("Error updating technician:", error)
    return NextResponse.json({ error: "Failed to update technician" }, { status: 500 })
  }
}

// DELETE /api/technicians/[id] - Delete technician (Admin & Accountant only)
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete related work records first
    await db.technicianWork.deleteMany({
      where: { technicianId: id }
    })

    // Delete related payments
    await db.technicianPayment.deleteMany({
      where: { technicianId: id }
    })

    // Now delete the technician
    await db.technician.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting technician:", error)
    return NextResponse.json({ error: "Failed to delete technician" }, { status: 500 })
  }
}
