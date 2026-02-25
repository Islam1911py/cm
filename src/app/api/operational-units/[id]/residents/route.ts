import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/operational-units/[id]/residents - Get all residents in a unit
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

    // Verify unit exists
    const unit = await db.operationalUnit.findUnique({
      where: { id }
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    const residents = await db.resident.findMany({
      where: { unitId: id },
      include: {
        unit: {
          include: {
            project: true
          }
        },
        tickets: true,
        deliveryOrders: true
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(residents)
  } catch (error) {
    console.error("Error fetching residents:", error)
    return NextResponse.json({ error: "Failed to fetch residents" }, { status: 500 })
  }
}
