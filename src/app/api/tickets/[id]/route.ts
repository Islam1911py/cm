import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyN8nEvent } from "@/lib/n8n-notify"

// GET /api/tickets/[id] - Get single ticket
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]

    const ticket = await db.ticket.findUnique({
      where: { id },
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

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Check if user has access to this ticket
    if (role === "PROJECT_MANAGER" && !projectIds.includes(ticket.unit.projectId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error("Error fetching ticket:", error)
    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 }
    )
  }
}

// PATCH /api/tickets/[id] - Update ticket
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]
    const userId = session.user.id

    // Check if ticket exists and user has access
    const existingTicket = await db.ticket.findUnique({
      where: { id },
      include: {
        unit: true
      }
    })

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Check if user has access to this ticket
    if (role === "PROJECT_MANAGER" && !projectIds.includes(existingTicket.unit.projectId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const {
      status,
      priority,
      resolution,
      assignedToId,
      category,
      residentResponse,
      contactName,
      contactPhone
    } = body

    // Prepare update data
    const updateData: any = {}

    if (status) updateData.status = status
    if (priority) updateData.priority = priority
    if (resolution !== undefined) updateData.resolution = resolution
    if (assignedToId) updateData.assignedToId = assignedToId
    if (category !== undefined) updateData.category = category
    if (residentResponse !== undefined) updateData.residentResponse = residentResponse
    if (contactName !== undefined) updateData.contactName = contactName
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone

    // If status is DONE, set closedAt
    if (status === "DONE") {
      updateData.closedAt = new Date()
    }

    // Update ticket
    const wasAlreadyDone = existingTicket.status === "DONE"

    const ticket = await db.ticket.update({
      where: { id },
      data: updateData,
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

    // Notify resident via WhatsApp when ticket is resolved (DONE)
    if (status === "DONE" && !wasAlreadyDone && ticket.resident?.whatsappPhone) {
      await notifyN8nEvent("TICKET_RESOLVED", {
        residentPhone: ticket.resident.whatsappPhone,
        residentName: ticket.resident.name,
        ticketNumber: `TICK-${ticket.id.substring(0, 8).toUpperCase()}`,
        ticket: {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          resolution: ticket.resolution ?? null
        },
        unit: {
          code: ticket.unit.code,
          projectName: ticket.unit.project?.name ?? null
        },
        humanReadable: {
          ar: `تم حل تذكرتك "${ticket.title}" في الوحدة ${ticket.unit.code}${ticket.resolution ? ` — ${ticket.resolution}` : ""}. شكراً لصبرك!`
        }
      })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error("Error updating ticket:", error)
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    )
  }
}

// DELETE /api/tickets/[id] - Delete ticket (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string

    // Only Admin can delete tickets
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.ticket.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Ticket deleted successfully" })
  } catch (error) {
    console.error("Error deleting ticket:", error)
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    )
  }
}
