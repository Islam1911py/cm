import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { normalizePhone } from "@/lib/phone"

const ALLOWED_ROLES = ["ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const hasName = Object.prototype.hasOwnProperty.call(body, "name")
    const hasRole = Object.prototype.hasOwnProperty.call(body, "role")
    const hasCanViewAllProjects = Object.prototype.hasOwnProperty.call(body, "canViewAllProjects")
    const hasWhatsappPhone = Object.prototype.hasOwnProperty.call(body, "whatsappPhone")
    const hasProjectIds = Object.prototype.hasOwnProperty.call(body, "projectIds")
    const hasPassword = Object.prototype.hasOwnProperty.call(body, "password")

    if (
      !hasName &&
      !hasRole &&
      !hasCanViewAllProjects &&
      !hasWhatsappPhone &&
      !hasProjectIds &&
      !hasPassword
    ) {
      return NextResponse.json(
        { error: "No valid fields provided" },
        { status: 400 }
      )
    }

    const updateData: Prisma.UserUpdateInput = {}
    let newRole: AllowedRole | undefined
    let requestedCanViewAllProjects: boolean | undefined
    let newPasswordHash: string | undefined

    if (hasName) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        )
      }
      updateData.name = body.name.trim()
    }

    if (hasRole) {
      if (typeof body.role !== "string" || !ALLOWED_ROLES.includes(body.role)) {
        return NextResponse.json(
          { error: "Invalid role" },
          { status: 400 }
        )
      }
      newRole = body.role as AllowedRole
      updateData.role = newRole
    }

    if (hasCanViewAllProjects) {
      if (typeof body.canViewAllProjects !== "boolean") {
        return NextResponse.json(
          { error: "Invalid canViewAllProjects value" },
          { status: 400 }
        )
      }
      requestedCanViewAllProjects = body.canViewAllProjects
    }

    if (hasWhatsappPhone) {
      if (body.whatsappPhone !== null && typeof body.whatsappPhone !== "string") {
        return NextResponse.json(
          { error: "Invalid whatsappPhone value" },
          { status: 400 }
        )
      }
      const normalizedPhone = normalizePhone(body.whatsappPhone)
      updateData.whatsappPhone = normalizedPhone ? normalizedPhone : null
    }

    if (hasPassword) {
      if (typeof body.password !== "string") {
        return NextResponse.json(
          { error: "Invalid password value" },
          { status: 400 }
        )
      }

      const trimmedPassword = body.password.trim()
      if (trimmedPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        )
      }
      newPasswordHash = await bcrypt.hash(trimmedPassword, 10)
      updateData.password = newPasswordHash
    }

    let projectIdsToAssign: string[] | undefined
    if (hasProjectIds) {
      if (!Array.isArray(body.projectIds)) {
        return NextResponse.json(
          { error: "projectIds must be an array" },
          { status: 400 }
        )
      }
      const filtered = body.projectIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      projectIdsToAssign = Array.from(new Set(filtered))
    }

    const user = await db.$transaction(async (tx) => {
      const existingUserRecord = await tx.user.findUnique({
        where: { id },
        select: { role: true }
      })

      if (!existingUserRecord) {
        throw new Error("User not found")
      }

      const effectiveRole: AllowedRole = (newRole ?? existingUserRecord.role) as AllowedRole

      if (projectIdsToAssign && effectiveRole !== "PROJECT_MANAGER") {
        throw new Error("Cannot assign projects to non-project managers")
      }

      if (effectiveRole !== "PROJECT_MANAGER") {
        updateData.canViewAllProjects = { set: false }
        projectIdsToAssign = undefined
        await tx.projectAssignment.deleteMany({ where: { userId: id } })
      } else if (requestedCanViewAllProjects !== undefined) {
        updateData.canViewAllProjects = { set: requestedCanViewAllProjects }
      }

      if (projectIdsToAssign) {
        const validProjects = await tx.project.findMany({
          where: { id: { in: projectIdsToAssign } },
          select: { id: true }
        })
        const validProjectIds = new Set(validProjects.map((project) => project.id))
        const invalidProjects = projectIdsToAssign.filter((projectId) => !validProjectIds.has(projectId))
        if (invalidProjects.length > 0) {
          throw new Error("Invalid project IDs provided")
        }

        const existingAssignments = await tx.projectAssignment.findMany({
          where: { userId: id },
          select: { projectId: true }
        })
        const existingIds = new Set(existingAssignments.map((assignment) => assignment.projectId))

        const toDelete = Array.from(existingIds).filter((projectId) => !validProjectIds.has(projectId))
        if (toDelete.length > 0) {
          await tx.projectAssignment.deleteMany({
            where: {
              userId: id,
              projectId: { in: toDelete }
            }
          })
        }

        const toCreate = projectIdsToAssign.filter((projectId) => !existingIds.has(projectId))
        if (toCreate.length > 0) {
          await tx.projectAssignment.createMany({
            data: toCreate.map((projectId) => ({ userId: id, projectId }))
          })
        }
      }

      const selectFields = {
        id: true,
        name: true,
        email: true,
        role: true,
        canViewAllProjects: true,
        whatsappPhone: true,
        assignedProjects: {
          select: {
            projectId: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      } as const

      if (Object.keys(updateData).length > 0) {
        return tx.user.update({
          where: { id },
          data: updateData,
          select: selectFields
        })
      }

      const existingUserSnapshot = await tx.user.findUnique({
        where: { id },
        select: selectFields
      })

      if (!existingUserSnapshot) {
        throw new Error("User not found")
      }

      return existingUserSnapshot
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error updating user permissions:", error)

    if (error instanceof Error) {
      if (error.message === "Invalid project IDs provided") {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      if (error.message === "User not found") {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }

      if (error.message === "Cannot assign projects to non-project managers") {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to update user", details: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id },
        select: { id: true }
      })

      if (!existing) {
        throw new Error("User not found")
      }

      await tx.projectAssignment.deleteMany({ where: { userId: id } })

      await tx.user.delete({ where: { id } })

      return { success: true }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error deleting user:", error)

    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: "Failed to delete user", details: String(error) },
      { status: 500 }
    )
  }
}
