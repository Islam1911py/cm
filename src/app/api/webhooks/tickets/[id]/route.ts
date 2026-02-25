import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { notifyN8nEvent } from "@/lib/n8n-notify"

type HumanReadable = {
  en?: string
  ar?: string
}

type Suggestion = {
  title: string
  prompt: string
  data?: Record<string, unknown>
}

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  NEW: { en: "New", ar: "جديدة" },
  IN_PROGRESS: { en: "In progress", ar: "قيد التنفيذ" },
  DONE: { en: "Resolved", ar: "منتهية" }
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) {
    return null
  }

  const parsed = typeof date === "string" ? new Date(date) : date
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return null
  }

  try {
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })
  } catch {
    return parsed.toISOString().split("T")[0] ?? null
  }
}

export async function PUT(
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
        {
          success: false,
          error: auth.error || "Unauthorized",
          humanReadable: {
            en: "API key failed verification, ticket update blocked.",
            ar: "مفتاح الـ API غير صالح، تم إيقاف تحديث التذكرة."
          },
          suggestions: [
            {
              title: "مراجعة بيانات API",
              prompt: "تأكد من أنك تستخدم مفتاح صلاحية مدير أو أدمن صالح."
            }
          ]
        },
        { status: 401 }
      )
    }

    // Only ADMIN or PROJECT_MANAGER can update tickets
    if (
      auth.context.role !== "ADMIN" &&
      auth.context.role !== "PROJECT_MANAGER"
    ) {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_UPDATED",
        `/api/webhooks/tickets/${id}`,
        "PUT",
        403,
        body,
        { error: "Insufficient permissions" },
        "Only ADMIN or PROJECT_MANAGER can update tickets",
        ipAddress
      )

      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to update tickets",
          humanReadable: {
            en: "Only admins or project managers can update tickets through this webhook.",
            ar: "فقط الأدمن أو مدير المشروع يمكنه تحديث التذكرة من خلال هذا الويب هوك."
          },
          suggestions: [
            {
              title: "استخدم مفتاح مدير",
              prompt: "أعد الطلب باستخدام مفتاح مدير مشروع أو أدمن."
            }
          ]
        },
        { status: 403 }
      )
    }

    // Find ticket
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        }
      }
    })

    if (!ticket) {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_UPDATED",
        `/api/webhooks/tickets/${id}`,
        "PUT",
        404,
        body,
        { error: "Ticket not found" },
        undefined,
        ipAddress
      )

      return NextResponse.json(
        {
          success: false,
          error: "Ticket not found",
          humanReadable: {
            en: "Cannot update because the ticket does not exist.",
            ar: "لا يمكن التحديث لأن التذكرة غير موجودة."
          },
          suggestions: [
            {
              title: "تأكيد رقم التذكرة",
              prompt: "راجع رقم التذكرة أو استخدم الاستعلام عن التذاكر قبل التحديث."
            }
          ]
        },
        { status: 404 }
      )
    }

    const { status, notes, resolution, assignedToId } = body

    // Update ticket
    const updatedTicket = await db.ticket.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes && { description: notes }),
        ...(resolution && { resolution }),
        ...(assignedToId && { assignedToId }),
        ...(status === "DONE" && { closedAt: new Date() })
      },
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        },
        assignedTo: true
      }
    })

    // Prepare callback response for n8n
    const eventType = updatedTicket.status === "DONE" ? "TICKET_RESOLVED" : "TICKET_UPDATED"
    const ticketNumber = `TICK-${updatedTicket.id.substring(0, 8).toUpperCase()}`
    const statusLabels = STATUS_LABELS[updatedTicket.status] ?? {
      en: updatedTicket.status,
      ar: updatedTicket.status
    }
    const updatedAtLabel = formatDate(updatedTicket.updatedAt)
    const closedAtLabel = formatDate(updatedTicket.closedAt)
    const assignedSegmentEn = updatedTicket.assignedTo
      ? ` Assigned to ${updatedTicket.assignedTo.name}.`
      : ""
    const assignedSegmentAr = updatedTicket.assignedTo
      ? ` ومُسندة إلى ${updatedTicket.assignedTo.name}.`
      : ""
    const resolutionSegmentEn = updatedTicket.resolution ? ` Resolution: ${updatedTicket.resolution}.` : ""
    const resolutionSegmentAr = updatedTicket.resolution ? ` الحل: ${updatedTicket.resolution}.` : ""
    const updatedAtSegmentEn = updatedAtLabel ? ` Updated on ${updatedAtLabel}.` : ""
    const updatedAtSegmentAr = updatedAtLabel ? ` تم التحديث بتاريخ ${updatedAtLabel}.` : ""
    const closedAtSegmentEn = eventType === "TICKET_RESOLVED" && closedAtLabel
      ? ` Closed on ${closedAtLabel}.`
      : ""
    const closedAtSegmentAr = eventType === "TICKET_RESOLVED" && closedAtLabel
      ? ` وأغلقت بتاريخ ${closedAtLabel}.`
      : ""

    const humanReadable: HumanReadable = {
      en: `Ticket ${ticketNumber} is now ${statusLabels.en}.${assignedSegmentEn}${resolutionSegmentEn}${updatedAtSegmentEn}${closedAtSegmentEn}`.trim(),
      ar: `التذكرة ${ticketNumber} أصبحت ${statusLabels.ar}.${assignedSegmentAr}${resolutionSegmentAr}${updatedAtSegmentAr}${closedAtSegmentAr}`.trim()
    }

    const suggestions: Suggestion[] = eventType === "TICKET_RESOLVED"
      ? [
          {
            title: "تأكيد الإغلاق مع الساكن",
            prompt: `أبلغ الساكن ${updatedTicket.resident.name} بأن التذكرة ${ticketNumber} تم إغلاقها وتأكد من رضاه.`,
            data: {
              residentId: updatedTicket.resident.id,
              ticketId: updatedTicket.id
            }
          },
          {
            title: "توثيق الملاحظات النهائية",
            prompt: "سجّل أي ملاحظات أو تكاليف مرتبطة بإغلاق التذكرة."
          }
        ]
      : [
          {
            title: "تحديد موعد الخدمة",
            prompt: `حدد موعداً لتنفيذ التذكرة ${ticketNumber} وتابع مع فريق الصيانة.`,
            data: {
              ticketId: updatedTicket.id,
              unitId: updatedTicket.unit.id
            }
          },
          {
            title: "تحديث الساكن",
            prompt: `أرسل تحديث للساكن ${updatedTicket.resident.name} بحالة التذكرة الحالية.`,
            data: {
              residentId: updatedTicket.resident.id,
              status: updatedTicket.status
            }
          }
        ]

    const meta = {
      event: eventType,
      status: updatedTicket.status,
      ticketId: updatedTicket.id,
      ticketNumber,
      unitId: updatedTicket.unit.id,
      unitCode: updatedTicket.unit.code,
      projectId: updatedTicket.unit.project?.id ?? null,
      projectName: updatedTicket.unit.project?.name ?? null,
      updatedAt: updatedTicket.updatedAt,
      closedAt: updatedTicket.closedAt ?? null,
      assignedToId: updatedTicket.assignedTo?.id ?? null
    }

    const n8nCallback = {
      event: eventType,
      ticketId: updatedTicket.id,
      ticketNumber,
      status: updatedTicket.status,
      resident: {
        id: updatedTicket.resident.id,
        name: updatedTicket.resident.name,
        email: updatedTicket.resident.email,
        phone: updatedTicket.resident.phone
      },
      unit: {
        code: updatedTicket.unit.code,
        name: updatedTicket.unit.name,
        project: updatedTicket.unit.project?.name ?? null
      },
      title: updatedTicket.title,
      description: updatedTicket.description,
      resolution: updatedTicket.resolution,
      assignedTo: updatedTicket.assignedTo
        ? {
            id: updatedTicket.assignedTo.id,
            name: updatedTicket.assignedTo.name
          }
        : null,
      updatedAt: updatedTicket.updatedAt,
      closedAt: updatedTicket.closedAt,
      meta,
      humanReadable,
      suggestions
    }

    const response = {
      success: true,
      ticket: updatedTicket,
      ticketNumber,
      meta,
      humanReadable,
      suggestions,
      n8nCallback,
      message: "Ticket updated successfully"
    }

    await notifyN8nEvent(eventType, {
      ticket: updatedTicket,
      ticketNumber,
      meta,
      humanReadable,
      suggestions
    })

    await logWebhookEvent(
      auth.context.keyId,
      eventType,
      `/api/webhooks/tickets/${id}`,
      "PUT",
      200,
      body,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error updating ticket:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      const { id } = await params
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_UPDATED",
        `/api/webhooks/tickets/${id}`,
        "PUT",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update ticket",
        humanReadable: {
          en: "Ticket update failed due to an internal error.",
          ar: "فشل تحديث التذكرة بسبب خطأ داخلي."
        },
        suggestions: [
          {
            title: "إعادة المحاولة",
            prompt: "أعد إرسال التحديث بعد قليل أو راجع السجلات لمعرفة سبب الخطأ."
          }
        ]
      },
      { status: 500 }
    )
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Unauthorized",
          humanReadable: {
            en: "API key failed verification, ticket lookup blocked.",
            ar: "مفتاح الـ API غير صالح، تعذر الاستعلام عن التذكرة."
          },
          suggestions: [
            {
              title: "مراجعة مفتاح الدخول",
              prompt: "استخدم مفتاح صلاحية صالح للاستعلام عن التذاكر."
            }
          ]
        },
        { status: 401 }
      )
    }

    // Find ticket
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        },
        assignedTo: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: "Ticket not found",
          humanReadable: {
            en: "No ticket exists with the specified identifier.",
            ar: "لا توجد تذكرة بالمعرف المحدد."
          },
          suggestions: [
            {
              title: "تأكيد المعرف",
              prompt: "استخدم قائمة التذاكر أو ملخص المشروع للحصول على المعرف الصحيح."
            }
          ]
        },
        { status: 404 }
      )
    }

    const ticketNumber = `TICK-${ticket.id.substring(0, 8).toUpperCase()}`
    const statusLabels = STATUS_LABELS[ticket.status] ?? {
      en: ticket.status,
      ar: ticket.status
    }
    const humanReadable: HumanReadable = {
      en: `Ticket ${ticketNumber} is currently ${statusLabels.en}.`,
      ar: `التذكرة ${ticketNumber} حالياً ${statusLabels.ar}.`
    }

    return NextResponse.json({
      success: true,
      ticket,
      ticketNumber,
      humanReadable
    })
  } catch (error) {
    console.error("Error fetching ticket:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch ticket",
        humanReadable: {
          en: "Ticket lookup failed due to an internal error.",
          ar: "فشل الاستعلام عن التذكرة بسبب خطأ داخلي."
        },
        suggestions: [
          {
            title: "إعادة الاستعلام",
            prompt: "حاول مرة أخرى أو راجع السجلات لمعرفة سبب الفشل."
          }
        ]
      },
      { status: 500 }
    )
  }
}
