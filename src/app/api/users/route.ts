import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { normalizePhone } from "@/lib/phone"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN and ACCOUNTANT can view users
    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")

    const where: any = {}
    if (role) {
      where.role = role // Filter by role if provided
    }

    const users = await db.user.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      select: {
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
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users", details: String(error) },
      { status: 500 }
    )
  }
}

type AllowedRole = "ADMIN" | "ACCOUNTANT" | "PROJECT_MANAGER"

const DEFAULT_COUNTRY_CODE = "+20"

function buildWhatsappNumber(countryCode: string, nationalNumber: string) {
  const safeCode = countryCode?.trim() || DEFAULT_COUNTRY_CODE
  const cleanedNational = nationalNumber.replace(/[^0-9]/g, "")
  if (!cleanedNational) {
    return null
  }

  const normalized = normalizePhone(`${safeCode}${cleanedNational}`)
  if (!normalized) {
    return null
  }

  return normalized.startsWith("+") ? normalized : `+${normalized}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      email,
      role,
      countryCode = DEFAULT_COUNTRY_CODE,
      phoneNumber = "",
      canViewAllProjects = false,
      projectIds = []
    } = body ?? {}

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    if (!role || !["ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const whatsappPhone = buildWhatsappNumber(countryCode, phoneNumber)

    if (!whatsappPhone) {
      return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 })
    }

    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { whatsappPhone }]
      },
      select: { id: true, email: true, whatsappPhone: true }
    })

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            existingUser.email === email
              ? "Email is already in use"
              : "WhatsApp number is already in use"
        },
        { status: 409 }
      )
    }

    const trimmedProjects: string[] = Array.isArray(projectIds)
      ? projectIds.filter((id) => typeof id === "string" && id.trim() !== "")
      : []

    if (role === "PROJECT_MANAGER" && !canViewAllProjects && trimmedProjects.length === 0) {
      return NextResponse.json(
        { error: "Project manager requires project assignments" },
        { status: 400 }
      )
    }

    const defaultPassword = "admin123"
    const passwordHash = await bcrypt.hash(defaultPassword, 10)

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          role: role as AllowedRole,
          whatsappPhone,
          password: passwordHash,
          canViewAllProjects: role === "PROJECT_MANAGER" ? canViewAllProjects : false
        }
      })

      if (role === "PROJECT_MANAGER" && trimmedProjects.length > 0) {
        await tx.projectAssignment.createMany({
          data: trimmedProjects.map((projectId) => ({
            userId: user.id,
            projectId
          }))
        })
      }

      const freshUser = await tx.user.findUnique({
        where: { id: user.id },
        select: {
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
        }
      })

      if (!freshUser) {
        throw new Error("Failed to load created user")
      }

      return freshUser
    })

    return NextResponse.json(
      {
        user: created,
        temporaryPassword: defaultPassword
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Failed to create user", details: String(error) },
      { status: 500 }
    )
  }
}
