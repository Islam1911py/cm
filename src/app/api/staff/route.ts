import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/staff - List staff (Admin & Accountant can see all, PM sees only their projects)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]
    const { searchParams } = new URL(req.url)
    const isProjectManagerParam = searchParams.get("isProjectManager")

    // PM can only see staff in their assigned projects
    // Admin and Accountant can see all staff
    const whereClause: any = {
      status: "ACTIVE",
      ...(role === "PROJECT_MANAGER"
        ? {
            unit: {
              project: { id: { in: projectIds } }
            }
          }
        : {})
    }

    // Filter by project manager status if requested
    if (isProjectManagerParam === "true") {
      whereClause.isProjectManager = true
    }

    const staff = await db.staff.findMany({
      where: whereClause,
      include: {
        unit: {
          include: {
            project: {
              select: { id: true, name: true }
            }
          }
        },
        projectAssignments: {
          include: {
            project: {
              select: { id: true, name: true }
            }
          }
        },
        unitAssignments: {
          include: {
            unit: {
              select: {
                id: true,
                name: true,
                code: true,
                projectId: true,
                project: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" as const }
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Error fetching staff:", error)
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
  }
}

// POST /api/staff - Create new staff (Admin & Accountant only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      type,
      role,
      phone,
      salary,
      paymentDay,
      currency,
      unitId,
      unitIds,
      isProjectManager,
      projectIds
    } = body

    // Validate required fields
    if (!name || !type || !role || !unitId) {
      return NextResponse.json(
        { error: "Name, type, role, and unitId are required" },
        { status: 400 }
      )
    }

    // Validate staff type
    if (!["OFFICE_STAFF", "FIELD_WORKER"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid staff type. Must be OFFICE_STAFF or FIELD_WORKER" },
        { status: 400 }
      )
    }

    // Validate that OFFICE_STAFF has a salary and paymentDay
    if (type === "OFFICE_STAFF" && !salary) {
      return NextResponse.json(
        { error: "Salary is required for office staff" },
        { status: 400 }
      )
    }

    if (type === "OFFICE_STAFF" && !paymentDay) {
      return NextResponse.json(
        { error: "Payment day is required for office staff" },
        { status: 400 }
      )
    }

    // Validate projectIds
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: "At least one project must be assigned" },
        { status: 400 }
      )
    }

    const uniqueProjectIds = [...new Set(projectIds.filter((id: string) => typeof id === "string" && id.trim() !== ""))]
    if (uniqueProjectIds.length === 0) {
      return NextResponse.json(
        { error: "At least one valid project must be assigned" },
        { status: 400 }
      )
    }

    const requestedUnitIds = Array.isArray(unitIds)
      ? unitIds.filter((id: string) => typeof id === "string" && id.trim() !== "")
      : []

    const combinedUnitIds = unitId ? [unitId, ...requestedUnitIds] : requestedUnitIds
    const uniqueUnitIds = [...new Set(combinedUnitIds)]

    if (uniqueUnitIds.length === 0) {
      return NextResponse.json(
        { error: "At least one unit must be assigned" },
        { status: 400 }
      )
    }

    const units = await db.operationalUnit.findMany({
      where: { id: { in: uniqueUnitIds } },
      select: { id: true, projectId: true }
    })

    if (units.length !== uniqueUnitIds.length) {
      return NextResponse.json(
        { error: "One or more selected units are invalid" },
        { status: 400 }
      )
    }

    // Ensure selected units belong to assigned projects
    const invalidUnit = units.find((unit) => !uniqueProjectIds.includes(unit.projectId))
    if (invalidUnit) {
      return NextResponse.json(
        { error: "Units must belong to the assigned projects" },
        { status: 400 }
      )
    }

    const primaryUnitId = unitId || uniqueUnitIds[0]

    const staff = await db.staff.create({
      data: {
        name,
        type,
        role,
        phone: phone || null,
        salary: type === "OFFICE_STAFF" ? parseFloat(salary) : null,
        paymentDay: type === "OFFICE_STAFF" ? parseInt(paymentDay) : null,
        currency: currency || "EGP",
        status: "ACTIVE",
        unitId: primaryUnitId,
        isProjectManager: isProjectManager || false,
        projectAssignments: {
          create: uniqueProjectIds.map((projectId: string) => ({
            projectId,
          })),
        },
        unitAssignments: {
          create: uniqueUnitIds.map((unit) => ({ unitId: unit })),
        },
      },
      include: {
        unit: {
          include: {
            project: true,
          },
        },
        projectAssignments: {
          include: {
            project: true,
          },
        },
        unitAssignments: {
          include: {
            unit: {
              select: {
                id: true,
                name: true,
                code: true,
                projectId: true,
                project: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(staff, { status: 201 })
  } catch (error) {
    console.error("Error creating staff:", error)
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 })
  }
}

// PUT /api/staff/[id] - Update staff (Admin & Accountant only)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      type,
      role,
      phone,
      salary,
      status,
      unitId,
      paymentDay,
      currency,
      isProjectManager,
      projectIds,
      unitIds
    } = body

    const existingStaff = await db.staff.findUnique({
      where: { id: params.id },
      include: {
        projectAssignments: true,
        unitAssignments: true
      }
    })

    if (!existingStaff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    const targetType = (type ?? existingStaff.type) as typeof existingStaff.type
    if (!targetType || !["OFFICE_STAFF", "FIELD_WORKER"].includes(targetType)) {
      return NextResponse.json({ error: "Invalid staff type" }, { status: 400 })
    }

    const projectIdsProvided = Array.isArray(projectIds)
    const uniqueProjectIds = projectIdsProvided
      ? [...new Set(projectIds.filter((id: string) => typeof id === "string" && id.trim() !== ""))]
      : existingStaff.projectAssignments.map((assignment) => assignment.projectId)

    if (!uniqueProjectIds.length) {
      return NextResponse.json({ error: "At least one project must be assigned" }, { status: 400 })
    }

    const unitIdsProvided = Array.isArray(unitIds)
    const cleanedUnitIds = unitIdsProvided
      ? unitIds.filter((id: string) => typeof id === "string" && id.trim() !== "")
      : existingStaff.unitAssignments.map((assignment) => assignment.unitId)

    const combinedUnitIds = unitId ? [unitId, ...cleanedUnitIds] : cleanedUnitIds
    const uniqueUnitIds = [...new Set(combinedUnitIds)]

    if (!uniqueUnitIds.length) {
      return NextResponse.json({ error: "At least one unit must be assigned" }, { status: 400 })
    }

    const units = await db.operationalUnit.findMany({
      where: { id: { in: uniqueUnitIds } },
      select: { id: true, projectId: true }
    })

    if (units.length !== uniqueUnitIds.length) {
      return NextResponse.json({ error: "One or more selected units are invalid" }, { status: 400 })
    }

    const invalidUnit = units.find((unit) => !uniqueProjectIds.includes(unit.projectId))
    if (invalidUnit) {
      return NextResponse.json({ error: "Units must belong to the assigned projects" }, { status: 400 })
    }

    const primaryUnitId = unitId || uniqueUnitIds[0]

    const salaryValue = salary !== undefined ? salary : existingStaff.salary
    const paymentDayValue = paymentDay !== undefined ? paymentDay : existingStaff.paymentDay

    if (targetType === "OFFICE_STAFF") {
      if (salaryValue === null || salaryValue === undefined || salaryValue === "") {
        return NextResponse.json({ error: "Salary is required for office staff" }, { status: 400 })
      }
      if (paymentDayValue === null || paymentDayValue === undefined || paymentDayValue === "") {
        return NextResponse.json({ error: "Payment day is required for office staff" }, { status: 400 })
      }
    }

    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type: targetType }),
      ...(role !== undefined && { role }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(status !== undefined && { status }),
      ...(currency !== undefined && { currency }),
      ...(primaryUnitId !== undefined && { unitId: primaryUnitId }),
      ...(isProjectManager !== undefined && { isProjectManager: Boolean(isProjectManager) }),
      updatedAt: new Date(),
    }

    if (salary !== undefined || targetType === "FIELD_WORKER") {
      updateData.salary = targetType === "OFFICE_STAFF" ? parseFloat(salaryValue) : null
    }

    if (paymentDay !== undefined || targetType === "FIELD_WORKER") {
      updateData.paymentDay = targetType === "OFFICE_STAFF" ? parseInt(paymentDayValue as string, 10) : null
    }

    const existingProjectIds = existingStaff.projectAssignments.map((assignment) => assignment.projectId)
    const projectIdsToDelete = projectIdsProvided
      ? existingProjectIds.filter((id) => !uniqueProjectIds.includes(id))
      : []
    const projectIdsToCreate = projectIdsProvided
      ? uniqueProjectIds.filter((id) => !existingProjectIds.includes(id))
      : []

    const existingUnitIds = existingStaff.unitAssignments.map((assignment) => assignment.unitId)
    const unitIdsToDelete = unitIdsProvided
      ? existingUnitIds.filter((id) => !uniqueUnitIds.includes(id))
      : []
    const unitIdsToCreate = unitIdsProvided
      ? uniqueUnitIds.filter((id) => !existingUnitIds.includes(id))
      : []

    const projectAssignmentsUpdate = projectIdsProvided
      ? {
          ...(projectIdsToDelete.length
            ? { deleteMany: { projectId: { in: projectIdsToDelete } } }
            : {}),
          ...(projectIdsToCreate.length
            ? { create: projectIdsToCreate.map((projectId) => ({ projectId })) }
            : {}),
        }
      : undefined

    const unitAssignmentsUpdate = unitIdsProvided
      ? {
          ...(unitIdsToDelete.length
            ? { deleteMany: { unitId: { in: unitIdsToDelete } } }
            : {}),
          ...(unitIdsToCreate.length
            ? { create: unitIdsToCreate.map((uId) => ({ unitId: uId })) }
            : {}),
        }
      : undefined

    const staff = await db.staff.update({
      where: { id: params.id },
      data: {
        ...updateData,
        ...(projectAssignmentsUpdate ? { projectAssignments: projectAssignmentsUpdate } : {}),
        ...(unitAssignmentsUpdate ? { unitAssignments: unitAssignmentsUpdate } : {}),
      },
      include: {
        unit: {
          include: {
            project: true,
          },
        },
        projectAssignments: {
          include: {
            project: true,
          },
        },
        unitAssignments: {
          include: {
            unit: {
              select: {
                id: true,
                name: true,
                code: true,
                projectId: true,
                project: true,
              },
            },
          },
        },
      },
    })

    // If arrays not provided, ensure existing assignments remain included in response
    if (!projectIdsProvided || !unitIdsProvided) {
      return NextResponse.json(staff)
    }

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Error updating staff:", error)
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 })
  }
}

// DELETE /api/staff/[id] - Delete staff (Admin & Accountant only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db.staff.update({
      where: { id: params.id },
      data: { status: "INACTIVE" }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting staff:", error)
    return NextResponse.json({ error: "Failed to delete staff" }, { status: 500 })
  }
}
