import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/residents - List all residents or filter by unit
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = new URL(req.url).searchParams
    const unitId = searchParams.get("unitId")

    let whereClause: any = unitId ? { unitId } : {}

    if (session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const assignments = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true }
      })

      const projectIds = assignments.map(a => a.projectId)

      if (projectIds.length === 0) {
        return NextResponse.json([])
      }

      if (unitId) {
        const unit = await db.operationalUnit.findUnique({
          where: { id: unitId },
          select: { projectId: true }
        })

        if (!unit || !projectIds.includes(unit.projectId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      } else {
        whereClause = {
          ...whereClause,
          unit: {
            projectId: { in: projectIds }
          }
        }
      }
    }

    const residents = await db.resident.findMany({
      where: whereClause,
      include: {
        unit: {
          include: {
            project: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(residents)
  } catch (error) {
    console.error("Error fetching residents:", error)
    return NextResponse.json({ error: "Failed to fetch residents" }, { status: 500 })
  }
}

// POST /api/residents - Create new resident
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, phone, address, unitId, status } = body

    if (!name || !unitId) {
      return NextResponse.json({ error: "Name and unitId are required" }, { status: 400 })
    }

    const resident = await db.resident.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        status: status || "ACTIVE",
        unitId
      },
      include: {
        unit: {
          include: {
            project: true
          }
        }
      }
    })

    return NextResponse.json(resident, { status: 201 })
  } catch (error) {
    console.error("Error creating resident:", error)
    return NextResponse.json({ error: "Failed to create resident" }, { status: 500 })
  }
}
