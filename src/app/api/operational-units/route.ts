import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/operational-units - List all units or filter by project
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = new URL(req.url).searchParams
    const projectId = searchParams.get("projectId")

    // Build base where clause
    let whereClause: any = { isActive: true }

    // If projectId filter is provided, use it
    if (projectId) {
      whereClause.projectId = projectId
    }
    // If user is PROJECT_MANAGER, only show their assigned projects
    else if (session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const assignments = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true }
      })
      
      const projectIds = assignments.map(a => a.projectId)
      
      if (projectIds.length === 0) {
        // PM with no assigned projects sees nothing
        return NextResponse.json([])
      }
      
      whereClause.projectId = { in: projectIds }
    }

    if (projectId && session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const assignment = await db.projectAssignment.findFirst({
        where: { userId: session.user.id, projectId }
      })

      if (!assignment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const units = await db.operationalUnit.findMany({
      where: whereClause,
      include: {
        project: {
          select: { id: true, name: true }
        },
        residents: true,
        _count: {
          select: { residents: true, tickets: true, deliveryOrders: true }
        }
      },
      orderBy: { id: "desc" as const }
    })

    return NextResponse.json(units)
  } catch (error) {
    console.error("Error fetching operational units:", error)
    return NextResponse.json({ error: "Failed to fetch operational units" }, { status: 500 })
  }
}

// POST /api/operational-units - Create new unit (Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, name, code, type } = body

    if (!projectId || !name || !code || !type) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Check if code is unique within project
    const existingUnit = await db.operationalUnit.findFirst({
      where: {
        projectId,
        code,
        isActive: true
      }
    })

    if (existingUnit) {
      return NextResponse.json({ error: "Unit code must be unique within project" }, { status: 400 })
    }

    const unit = await db.operationalUnit.create({
      data: {
        projectId,
        name,
        code,
        type,
        isActive: true
      }
    })

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    console.error("Error creating operational unit:", error)
    return NextResponse.json({ error: "Failed to create operational unit" }, { status: 500 })
  }
}

// PUT /api/operational-units/[id] - Update unit (Admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, code, type, isActive } = body

    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code }),
      ...(type !== undefined && { type }),
      ...(isActive !== undefined && { isActive })
    }

    // If code is being changed, check for uniqueness
    if (code !== undefined) {
      const existingUnit = await db.operationalUnit.findFirst({
        where: {
          id: { not: params.id },
          projectId: (await db.operationalUnit.findUnique({ where: { id: params.id } }))?.projectId,
          code,
          isActive: true
        }
      })

      if (existingUnit) {
        return NextResponse.json({ error: "Unit code must be unique within project" }, { status: 400 })
      }
    }

    const unit = await db.operationalUnit.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error updating operational unit:", error)
    return NextResponse.json({ error: "Failed to update operational unit" }, { status: 500 })
  }
}

// DELETE /api/operational-units/[id] - Delete unit (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db.operationalUnit.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting operational unit:", error)
    return NextResponse.json({ error: "Failed to delete operational unit" }, { status: 500 })
  }
}
