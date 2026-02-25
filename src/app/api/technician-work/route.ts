import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/technician-work - List all work or filter by technician/unit/project
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT" && session.user.role !== "PROJECT_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const technicianId = searchParams.get("technicianId")
    const unitId = searchParams.get("unitId")
    const projectId = searchParams.get("projectId")
    const isPaid = searchParams.get("isPaid")

    const whereClause: any = {}

    if (technicianId) {
      whereClause.technicianId = technicianId
    }

    if (unitId) {
      whereClause.unitId = unitId
    }

    if (projectId) {
      if (!whereClause.unit) whereClause.unit = {}
      whereClause.unit.project = { id: projectId }
    }

    // PROJECT_MANAGER: Filter by assigned projects
    if (session.user.role === "PROJECT_MANAGER") {
      const assignments = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true }
      })
      const projectIds = assignments.map(a => a.projectId)
      
      if (projectIds.length === 0) {
        return NextResponse.json([])
      }
      
      if (!whereClause.unit) whereClause.unit = {}
      whereClause.unit.project = {
        id: { in: projectIds }
      }
    }

    if (isPaid !== null) {
      whereClause.isPaid = isPaid === "true"
    }

    const work = await db.technicianWork.findMany({
      where: whereClause,
      include: {
        technician: true,
        unit: {
          include: {
            project: true
          }
        }
      },
      orderBy: { createdAt: "desc" as const }
    })

    return NextResponse.json(work)
  } catch (error) {
    console.error("Error fetching technician work:", error)
    return NextResponse.json({ error: "Failed to fetch technician work" }, { status: 500 })
  }
}

// POST /api/technician-work - Create work assignment (without amount yet)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT" && session.user.role !== "PROJECT_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { technicianId, unitId } = body

    // Validation
    if (!technicianId || !unitId) {
      return NextResponse.json({ error: "technicianId and unitId are required" }, { status: 400 })
    }

    // PROJECT_MANAGER: Verify unit is in assigned project
    if (session.user.role === "PROJECT_MANAGER") {
      const assignment = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true }
      })
      const projectIds = assignment.map(a => a.projectId)
      
      const unit = await db.operationalUnit.findUnique({
        where: { id: unitId },
        select: { projectId: true }
      })
      
      if (!unit || !projectIds.includes(unit.projectId)) {
        return NextResponse.json({ error: "Unauthorized: Unit not in your assigned projects" }, { status: 403 })
      }
    }

    // Create technician work with PENDING status (no amount or description yet)
    const work = await db.technicianWork.create({
      data: {
        technicianId,
        unitId,
        status: "PENDING", // Initial state
        createdAt: new Date()
      },
      include: {
        technician: true,
        unit: {
          include: {
            project: true
          }
        }
      }
    })

    return NextResponse.json(work, { status: 201 })
  } catch (error) {
    console.error("Error creating technician work:", error)
    return NextResponse.json({ error: "Failed to create work record" }, { status: 500 })
  }
}

