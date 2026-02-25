import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/operational-units/[id]
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

    const unit = await db.operationalUnit.findUnique({
      where: { id },
      include: {
        project: true,
        _count: {
          select: { residents: true, tickets: true, deliveryOrders: true }
        }
      }
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error fetching operational unit:", error)
    return NextResponse.json({ error: "Failed to fetch operational unit" }, { status: 500 })
  }
}

// PUT /api/operational-units/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, code, type, isActive } = body

    const unit = await db.operationalUnit.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(type && { type }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        project: true,
        _count: {
          select: { residents: true, tickets: true, deliveryOrders: true }
        }
      }
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error updating operational unit:", error)
    return NextResponse.json({ error: "Failed to update operational unit" }, { status: 500 })
  }
}

// PATCH /api/operational-units/[id] - For partial updates (billing info)
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

    // Only ADMIN and ACCOUNTANT can update billing
    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { monthlyManagementFee, monthlyBillingDay } = body

    const updateData: any = {}
    if (monthlyManagementFee !== undefined) {
      updateData.monthlyManagementFee = monthlyManagementFee
    }
    if (monthlyBillingDay !== undefined) {
      updateData.monthlyBillingDay = monthlyBillingDay
    }

    const unit = await db.operationalUnit.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
        _count: {
          select: { residents: true, tickets: true, deliveryOrders: true }
        }
      }
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error updating billing info:", error)
    return NextResponse.json({ error: "Failed to update billing info" }, { status: 500 })
  }
}

// DELETE /api/operational-units/[id]
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

    await db.operationalUnit.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting operational unit:", error)
    return NextResponse.json({ error: "Failed to delete operational unit" }, { status: 500 })
  }
}
