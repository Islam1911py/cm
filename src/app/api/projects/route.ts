import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get("projectId")

    let whereClause: any = { isActive: true }
    if (projectId) {
      whereClause.id = projectId
    }

    // For project managers, only show their assigned projects
    if (session.user.role === "PROJECT_MANAGER" && !session.user.canViewAllProjects) {
      const userAssignments = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true },
      })
      const assignedProjectIds = userAssignments.map((a) => a.projectId)
      if (assignedProjectIds.length === 0) {
        return NextResponse.json([])
      }
      if (projectId && !assignedProjectIds.includes(projectId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      whereClause.id = projectId ? projectId : { in: assignedProjectIds }
    }

    const projects = await db.project.findMany({
      where: whereClause,
      include: {
        projectElements: {
          include: {
            type: true,
          },
          orderBy: { name: "asc" },
        },
        operationalUnits: {
          where: { isActive: true },
          include: {
            technicianWorks: {
              include: {
                technician: true
              }
            },
            residents: true,
            tickets: {
              include: {
                resident: {
                  select: { id: true, name: true, phone: true }
                },
              }
            },
            staff: {
              include: {
                unit: {
                  select: { id: true, name: true }
                }
              }
            },
            staffUnitAssignments: {
              include: {
                staff: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    role: true,
                    type: true,
                    status: true,
                    unitId: true,
                    unit: {
                      select: { id: true, name: true }
                    }
                  }
                }
              }
            }
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, typeId, monthlyManagementFee, isActive } = body

    if (!name || !typeId) {
      return NextResponse.json(
        { error: "Project name and type are required" },
        { status: 400 }
      )
    }

    // Verify type exists
    const type = await db.projectType.findUnique({
      where: { id: typeId },
    })

    if (!type) {
      return NextResponse.json(
        { error: "Project type not found" },
        { status: 404 }
      )
    }

    const project = await db.project.create({
      data: {
        name,
        typeId,
        monthlyManagementFee: monthlyManagementFee || 0,
        isActive: isActive !== false,
      },
      include: {
        projectType: true,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    )
  }
}
