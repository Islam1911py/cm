import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const userSelectFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  whatsappPhone: true,
  canViewAllProjects: true
} as const

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: userSelectFields
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching current user:", error)
    return NextResponse.json(
      { error: "Failed to load profile", details: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { name, currentPassword, newPassword } = body as {
      name?: unknown
      currentPassword?: unknown
      newPassword?: unknown
    }

    const existingUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        ...userSelectFields,
        password: true
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}

    if (name !== undefined) {
      if (typeof name !== "string") {
        return NextResponse.json({ error: "Name must be a string" }, { status: 400 })
      }
      const trimmedName = name.trim()
      if (!trimmedName) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
      }
      if (trimmedName !== existingUser.name) {
        updates.name = trimmedName
      }
    }

    if (newPassword !== undefined) {
      if (typeof newPassword !== "string") {
        return NextResponse.json({ error: "New password must be a string" }, { status: 400 })
      }
      const trimmedNewPassword = newPassword.trim()
      if (trimmedNewPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters" },
          { status: 400 }
        )
      }

      if (typeof currentPassword !== "string" || !currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 }
        )
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, existingUser.password)
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        )
      }

      const isSamePassword = await bcrypt.compare(trimmedNewPassword, existingUser.password)
      if (isSamePassword) {
        return NextResponse.json(
          { error: "New password must be different from the current password" },
          { status: 400 }
        )
      }

      updates.password = await bcrypt.hash(trimmedNewPassword, 10)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id: existingUser.id },
      data: updates,
      select: userSelectFields
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Error updating current user:", error)
    return NextResponse.json(
      { error: "Failed to update profile", details: String(error) },
      { status: 500 }
    )
  }
}
