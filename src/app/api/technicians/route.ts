import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/technicians - List all technicians
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT" && session.user.role !== "PROJECT_MANAGER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Simplified: Just fetch all technicians
    // Filtering by project now happens through TechnicianWork -> OperationalUnit -> Project
    const technicians = await db.technician.findMany({
      include: {
        works: {
          include: {
            unit: {
              include: {
                project: true
              }
            }
          }
        },
        payments: true
      },
      orderBy: { createdAt: "desc" as const }
    })

    return NextResponse.json(technicians)
  } catch (error) {
    console.error("Error fetching technicians:", error)
    return NextResponse.json({ error: "Failed to fetch technicians" }, { status: 500 })
  }
}

// POST /api/technicians - Create new technician (Admin & Accountant only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, phone, specialty, notes } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const technician = await db.technician.create({
      data: {
        name,
        phone: phone || null,
        specialty: specialty || "عام",
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json(technician, { status: 201 })
  } catch (error) {
    console.error("Error creating technician:", error)
    return NextResponse.json({ error: "Failed to create technician" }, { status: 500 })
  }
}

