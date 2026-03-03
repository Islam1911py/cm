import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { WEBHOOK_ALWAYS_OK } from "@/lib/webhook-response"

// POST /api/webhooks/tickets/[id]/notes - إضافة ملاحظات على الشكاوى
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const { id } = await params
    const body = await req.json()

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized", humanReadable: { ar: "مفتاح غير صالح أو غير مصرح. تحقق من المفتاح." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const { note, status } = body

    if (!note) {
      return NextResponse.json(
        { success: false, error: "Note is required", humanReadable: { ar: "مطلوب: note (نص الملاحظة) في الـ body." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // Find ticket
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: { resident: true, unit: true }
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found", humanReadable: { ar: "التذكرة غير موجودة. تحقق من المعرف في الرابط." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // Update ticket with note and optional status
    const updatedTicket = await db.ticket.update({
      where: { id },
      data: {
        description: `${ticket.description}\n\n---\n[${new Date().toISOString()}] ${note}`,
        ...(status && { status })
      },
      include: { resident: true, unit: true }
    })

    const response = {
      success: true,
      ticketId: updatedTicket.id,
      status: updatedTicket.status,
      resident: {
        email: updatedTicket.resident.email,
        phone: updatedTicket.resident.phone,
        name: updatedTicket.resident.name
      },
      message: "Note added successfully"
    }

    await logWebhookEvent(
      auth.context.keyId,
      "TICKET_UPDATED",
      `/api/webhooks/tickets/${id}/notes`,
      "POST",
      200,
      body,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response, { status: WEBHOOK_ALWAYS_OK })
  } catch (error) {
    console.error("Error adding note:", error)

    return NextResponse.json(
      { success: false, error: "Failed to add note", humanReadable: { ar: "حدث خطأ أثناء إضافة الملاحظة. جرّب مرة أخرى." } },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
}
