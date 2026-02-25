import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/delivery-orders/[id] - Get single delivery order
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

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]

    const order = await db.deliveryOrder.findUnique({
      where: { id },
      include: {
        resident: true,
        unit: true,
        project: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: "Delivery order not found" }, { status: 404 })
    }

    // Check if user has access to this order
    if (role === "PROJECT_MANAGER" && !projectIds.includes(order.projectId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error("Error fetching delivery order:", error)
    return NextResponse.json(
      { error: "Failed to fetch delivery order" },
      { status: 500 }
    )
  }
}

// PATCH /api/delivery-orders/[id] - Update delivery order
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]
    const userId = session.user.id

    // Check if order exists and user has access
    const existingOrder = await db.deliveryOrder.findUnique({
      where: { id }
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Delivery order not found" }, { status: 404 })
    }

    // Check if user has access to this order
    if (role === "PROJECT_MANAGER" && !projectIds.includes(existingOrder.projectId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { status, notes } = body

    // Prepare update data
    const updateData: any = {}

    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

    // If status is DELIVERED, set deliveredAt and deliveredBy
    if (status === "DELIVERED") {
      updateData.deliveredAt = new Date()
      updateData.deliveredBy = userId
    }

    // Update delivery order
    const order = await db.deliveryOrder.update({
      where: { id },
      data: updateData,
      include: {
        resident: true,
        unit: true,
        project: true
      }
    })

    return NextResponse.json(order)
  } catch (error) {
    console.error("Error updating delivery order:", error)
    return NextResponse.json(
      { error: "Failed to update delivery order" },
      { status: 500 }
    )
  }
}

// DELETE /api/delivery-orders/[id] - Delete delivery order (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string

    // Only Admin can delete delivery orders
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.deliveryOrder.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Delivery order deleted successfully" })
  } catch (error) {
    console.error("Error deleting delivery order:", error)
    return NextResponse.json(
      { error: "Failed to delete delivery order" },
      { status: 500 }
    )
  }
}
