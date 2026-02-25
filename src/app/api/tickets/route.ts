import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyN8nEvent } from "@/lib/n8n-notify"

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

    const where: any = {}
    const unitFilters: any = {}

    if (role === "PROJECT_MANAGER") {
      unitFilters.projectId = { in: projectIds }
    }

    if (projectId && role === "ADMIN") {
      unitFilters.projectId = projectId
    }

    if (Object.keys(unitFilters).length > 0) {
      where.unit = unitFilters
    }

    if (status) {
      where.status = status
    }

    const tickets = await db.ticket.findMany({
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
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error("Error fetching tickets:", error)
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      residentPhone,
      residentName,
      projectName,
      unitName,
      description,
      category,
      source
    } = body

    const trimmedDescription = (description ?? "").trim()
    const trimmedProjectName = (projectName ?? "").trim()
    const trimmedUnitName = (unitName ?? "").trim()
    const trimmedPhone = (residentPhone ?? "").trim()

    if (!trimmedPhone || !trimmedProjectName || !trimmedUnitName || !trimmedDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const project = await db.project.findFirst({
      where: {
        name: trimmedProjectName
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    const unit = await db.operationalUnit.findFirst({
      where: {
        name: trimmedUnitName,
        projectId: project.id
      }
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      )
    }

    const resident = await db.resident.findFirst({
      where: {
        unitId: unit.id,
        OR: [
          { phone: trimmedPhone },
          { whatsappPhone: trimmedPhone }
        ]
      }
    })

    const isResidentKnown = Boolean(resident)
    const contactNameValue: string | undefined = resident?.name ?? (
      typeof residentName === "string" && residentName.trim().length > 0
        ? residentName.trim()
        : undefined
    )
    const categoryValue: string | undefined =
      typeof category === "string" && category.trim().length > 0
        ? category.trim()
        : undefined

    const ticket = await db.ticket.create({
      data: {
        title: trimmedDescription.substring(0, 100),
        description: trimmedDescription,
        status: "NEW",
        unitId: unit.id,
        residentId: resident?.id ?? null,
        contactName: contactNameValue,
        contactPhone: trimmedPhone,
        isResidentKnown,
        category: categoryValue,
        source: source ? String(source) : "WHATSAPP"
      },
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
        }
      }
    })

    await notifyN8nEvent("TICKET_CREATED", {
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt
      },
      unit: {
        id: ticket.unit.id,
        code: ticket.unit.code,
        name: ticket.unit.name,
        project: ticket.unit.project.name
      },
      resident: ticket.resident
        ? {
            id: ticket.resident.id,
            name: ticket.resident.name,
            phone: ticket.resident.phone,
            email: ticket.resident.email
          }
        : null
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error("Error creating ticket:", error)
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    )
  }
}
