import { db } from "@/lib/db"
import { logWebhookEvent } from "@/lib/n8n-auth"

type AuthContext = { keyId: string | null }

function formatDate(date: Date | string) {
  const parsed = typeof date === "string" ? new Date(date) : date
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null
  try {
    return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return (parsed as Date).toISOString().split("T")[0] ?? null
  }
}

/**
 * منطق قائمة/استعلام التذاكر — يُستدعى inline من resident أو من GET /api/webhooks/tickets.
 * يرجع نفس شكل الرد (tickets أو ticket واحد، humanReadable) بدون fetch ذاتي.
 */
export async function getTicketsFromWebhook(
  params: { residentPhone: string; ticketNumber?: string | null },
  authContext: AuthContext,
  ipAddress: string
): Promise<Record<string, unknown>> {
  const { residentPhone, ticketNumber: ticketNumberParam } = params

  const resident = await db.resident.findFirst({
    where: {
      OR: [{ phone: residentPhone }, { whatsappPhone: residentPhone }]
    }
  })

  const statusLabel: Record<string, string> = {
    NEW: "جديدة",
    IN_PROGRESS: "قيد التنفيذ",
    DONE: "تم الحل"
  }

  if (ticketNumberParam && typeof ticketNumberParam === "string") {
    const raw = ticketNumberParam.trim().toUpperCase().replace(/^TICK-?/i, "")
    const idPrefix = raw.substring(0, 8).toLowerCase()
    if (idPrefix.length < 8) {
      return {
        success: false,
        error: "Invalid ticket number format",
        humanReadable: { ar: "رقم الشكوى غير صحيح. استخدم الصيغة مثل: TICK-ABC12345" }
      }
    }
    const candidates = await db.ticket.findMany({
      where: { id: { startsWith: idPrefix } },
      include: {
        unit: { include: { project: true } },
        assignedTo: { select: { name: true } }
      }
    })
    const owned = candidates.find(
      t =>
        (resident && t.residentId === resident.id) ||
        (!resident && t.contactPhone === residentPhone)
    )
    if (!owned) {
      return {
        success: false,
        error: "Ticket not found or not yours",
        humanReadable: { ar: `مفيش شكوى برقم ${ticketNumberParam} مرتبطة برقمك، أو الرقم غير صحيح.` }
      }
    }
    const ticketNumber = `TICK-${owned.id.substring(0, 8).toUpperCase()}`
    const singleFormatted = {
      id: owned.id,
      ticketNumber,
      title: owned.title,
      description: owned.description,
      status: owned.status,
      statusAr: statusLabel[owned.status] ?? owned.status,
      priority: owned.priority,
      resolution: owned.resolution ?? null,
      unitCode: owned.unit.code,
      projectName: owned.unit.project?.name ?? null,
      assignedTo: owned.assignedTo?.name ?? null,
      createdAt: formatDate(owned.createdAt),
      closedAt: owned.closedAt ? formatDate(owned.closedAt) : null
    }
    await logWebhookEvent(
      authContext.keyId,
      "TICKET_CREATED",
      "/api/webhooks/tickets",
      "GET",
      200,
      { residentPhone, ticketNumber: ticketNumberParam },
      { single: true },
      undefined,
      ipAddress
    )
    return {
      success: true,
      resident: resident ? { id: resident.id, name: resident.name } : null,
      isRegistered: !!resident,
      ticket: singleFormatted,
      humanReadable: { ar: `التذكرة ${ticketNumber} حالياً ${statusLabel[owned.status] ?? owned.status}.` }
    }
  }

  const ticketWhere = resident ? { residentId: resident.id } : { contactPhone: residentPhone }
  const tickets = await db.ticket.findMany({
    where: ticketWhere,
    include: {
      unit: { include: { project: true } },
      assignedTo: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  })

  if (!resident && tickets.length === 0) {
    return {
      success: false,
      error: "No tickets found",
      humanReadable: { ar: `مفيش شكاوى مسجلة بالرقم ${residentPhone}` }
    }
  }

  const formattedTickets = tickets.map(t => ({
    id: t.id,
    ticketNumber: `TICK-${t.id.substring(0, 8).toUpperCase()}`,
    title: t.title,
    description: t.description,
    status: t.status,
    statusAr: statusLabel[t.status] ?? t.status,
    priority: t.priority,
    resolution: t.resolution ?? null,
    unitCode: t.unit.code,
    projectName: t.unit.project?.name ?? null,
    assignedTo: t.assignedTo?.name ?? null,
    createdAt: formatDate(t.createdAt),
    closedAt: t.closedAt ? formatDate(t.closedAt) : null
  }))

  const openCount = tickets.filter(t => t.status !== "DONE").length
  const doneCount = tickets.filter(t => t.status === "DONE").length

  await logWebhookEvent(
    authContext.keyId,
    "TICKET_CREATED",
    "/api/webhooks/tickets",
    "GET",
    200,
    { residentPhone },
    { total: tickets.length },
    undefined,
    ipAddress
  )

  return {
    success: true,
    resident: resident ? { id: resident.id, name: resident.name } : null,
    isRegistered: !!resident,
    tickets: formattedTickets,
    meta: { total: tickets.length, open: openCount, done: doneCount },
    humanReadable: { ar: `عندك ${tickets.length} تذاكر — ${openCount} مفتوحة، ${doneCount} محلولة` }
  }
}
