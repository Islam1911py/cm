import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/delivery-orders - List delivery orders
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]
    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get("status")
    const projectId = searchParams.get("projectId")

    // Build where clause
    let where: any = {}

    // Project Managers can only see their assigned projects
    if (role === "PROJECT_MANAGER") {
      where.projectId = { in: projectIds }
    }

    // Filter by status if provided
    if (status) {
      where.status = status
    }

    // Filter by project if provided (Admin only)
    if (projectId && role === "ADMIN") {
      where.unit = { projectId }
    }

    // Fetch delivery orders with relations
    const orders = await db.deliveryOrder.findMany({
      where,
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        deliveredByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error("Error fetching delivery orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch delivery orders" },
      { status: 500 }
    )
  }
}

// POST /api/delivery-orders - Create delivery order (for n8n webhook)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      residentPhone,
      unitCode,
      orderText,
      projectId
    } = body

    // Validate required fields
    if (!residentPhone || !unitCode || !orderText || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Find resident by phone
    const resident = await db.resident.findFirst({
      where: {
        phone: residentPhone,
        projectId: projectId
      },
      include: {
        unit: true
      }
    })

    if (!resident) {
      return NextResponse.json(
        { error: "Resident not found" },
        { status: 404 }
      )
    }

    // Create delivery order
    const order = await db.deliveryOrder.create({
      data: {
        orderText,
        status: "NEW",
        residentId: resident.id,
        unitId: resident.unitId,
        projectId: projectId
      },
      include: {
        resident: true,
        unit: true,
        project: true
      }
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Error creating delivery order:", error)
    return NextResponse.json(
      { error: "Failed to create delivery order" },
      { status: 500 }
    )
  }
}
