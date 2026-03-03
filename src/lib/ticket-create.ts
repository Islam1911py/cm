import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { logWebhookEvent } from "@/lib/n8n-auth"
import { notifyN8nEvent } from "@/lib/n8n-notify"
import { buildPhoneVariants } from "@/lib/phone"
import { normalizeArabicNumerals } from "@/lib/project-slug"

type HumanReadable = { en?: string; ar?: string }
type Suggestion = { title: string; prompt: string; data?: Record<string, unknown> }
type UnitWithProject = Prisma.OperationalUnitGetPayload<{ include: { project: true } }>
type AuthContext = { role: string; keyId: string | null }

function formatDate(date: Date | string) {
  const parsed = typeof date === "string" ? new Date(date) : date
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null
  try {
    return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return (parsed as Date).toISOString().split("T")[0] ?? null
  }
}

async function getPMsForProject(projectId: string) {
  const assignments = await db.projectAssignment.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, whatsappPhone: true, role: true } } }
  })
  return assignments
    .filter(a => a.user.role === "PROJECT_MANAGER" && a.user.whatsappPhone)
    .map(a => ({ name: a.user.name, phone: a.user.whatsappPhone! }))
}

export type CreateTicketResult = { status: number; data: Record<string, unknown> }

export async function createTicketFromWebhook(
  body: Record<string, unknown>,
  authContext: AuthContext,
  ipAddress: string
): Promise<CreateTicketResult> {
  const {
    residentName,
    residentEmail,
    residentPhone,
    senderPhone,
    unitCode,
    unitName,
    buildingNumber,
    projectName,
    title,
    description,
    priority
  } = body

  const trimmedResidentName = typeof residentName === "string" ? residentName.trim() : ""
  const trimmedDescription = typeof description === "string" ? description.trim() : ""
  const rawTitle = typeof title === "string" ? title.trim() : ""
  const trimmedTitle = rawTitle || trimmedDescription.substring(0, 100)
  const trimmedProjectName = typeof projectName === "string" ? projectName.trim() : ""
  const callerPhone =
    (typeof senderPhone === "string" && senderPhone.trim()) ||
    (typeof residentPhone === "string" && residentPhone.trim()) ||
    ""
  const trimmedUnitCode =
    typeof unitCode === "string" && unitCode.trim() !== "" ? unitCode.trim() : undefined
  const trimmedBuildingNumber =
    typeof buildingNumber === "string" && buildingNumber.trim() !== ""
      ? buildingNumber.trim()
      : undefined
  const trimmedUnitName =
    typeof unitName === "string" && unitName.trim() !== "" ? unitName.trim() : undefined
  const requestedUnitCode = trimmedUnitCode ?? trimmedBuildingNumber

  if (!trimmedTitle) {
    await logWebhookEvent(
      authContext.keyId,
      "TICKET_CREATED",
      "/api/webhooks/tickets",
      "POST",
      400,
      body,
      { error: "Missing required fields" },
      "Missing: title or description",
      ipAddress
    )
    return {
      status: 400,
      data: {
        success: false,
        error: "Missing required fields: title or description",
        humanReadable: {
          en: "Need at least a description or title to log a request.",
          ar: "يجب إدخال وصف المشكلة على الأقل لتسجيل التذكرة."
        },
        suggestions: [
          { title: "إعادة إرسال البيانات", prompt: "أعد إرسال الطلب متضمناً وصف المشكلة، رقم المبنى، واسم المشروع." }
        ]
      }
    }
  }

  if (!requestedUnitCode && !trimmedUnitName) {
    await logWebhookEvent(
      authContext.keyId,
      "TICKET_CREATED",
      "/api/webhooks/tickets",
      "POST",
      400,
      body,
      { error: "Missing unit information" },
      "Missing unit identifier (unitCode/buildingNumber or unitName)",
      ipAddress
    )
    return {
      status: 400,
      data: {
        success: false,
        error: "Missing unit details. Please provide building number or unit name.",
        humanReadable: {
          en: "Please include a unit code, building number, or unit name so we can route the ticket.",
          ar: "من فضلك أرسل كود الوحدة أو رقم المبنى أو اسم الوحدة لربط التذكرة بشكل صحيح."
        },
        suggestions: [{ title: "تحديد الوحدة", prompt: "اذكر كود الوحدة أو اسمها كما هو مسجل في النظام." }]
      }
    }
  }

  let project: { id: string; name: string } | null = null
  if (trimmedProjectName) {
    project = await db.project.findFirst({
      where: { name: trimmedProjectName },
      select: { id: true, name: true }
    })
    if (!project) {
      const fallbackProject = await db.$queryRaw<{ id: string; name: string }[]>(
        Prisma.sql`SELECT "id", "name" FROM "Project" WHERE LOWER("name") = LOWER(${trimmedProjectName}) LIMIT 1`
      )
      if (fallbackProject.length > 0) project = fallbackProject[0]
    }
    if (!project) {
      const { findProjectBySlugOrName } = await import("@/lib/project-slug")
      const bySlug = await findProjectBySlugOrName(db, trimmedProjectName)
      if (bySlug) project = { id: bySlug.id, name: bySlug.name }
    }
    if (!project) {
      return {
        status: 404,
        data: {
          success: false,
          error: "Project not found",
          requestedName: trimmedProjectName,
          humanReadable: {
            en: `No project matches "${trimmedProjectName}".`,
            ar: `لا يوجد مشروع مطابق للاسم "${trimmedProjectName}".`
          },
          suggestions: [{ title: "تأكيد اسم المشروع", prompt: "راجع اسم المشروع في لوحة الإدارة ثم أعد المحاولة." }]
        }
      }
    }
  }

  let unit: UnitWithProject | null = null
  if (requestedUnitCode) {
    unit = await db.operationalUnit.findFirst({
      where: { code: requestedUnitCode, ...(project ? { projectId: project.id } : {}) },
      include: { project: true }
    })
    if (!unit && project) {
      const fallbackUnit = await db.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT "id" FROM "OperationalUnit"
          WHERE LOWER("code") = LOWER(${requestedUnitCode}) AND "projectId" = ${project.id}
          LIMIT 1
        `
      )
      if (fallbackUnit.length > 0) {
        unit = await db.operationalUnit.findUnique({
          where: { id: fallbackUnit[0].id },
          include: { project: true }
        })
      }
    }
  }

  if (!unit && trimmedUnitName) {
    unit = await db.operationalUnit.findFirst({
      where: { name: trimmedUnitName, ...(project ? { projectId: project.id } : {}) },
      include: { project: true }
    })
    if (!unit && project) {
      const fallbackUnitByName = await db.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT "id" FROM "OperationalUnit"
          WHERE LOWER("name") = LOWER(${trimmedUnitName}) AND "projectId" = ${project.id}
          LIMIT 1
        `
      )
      if (fallbackUnitByName.length > 0) {
        unit = await db.operationalUnit.findUnique({
          where: { id: fallbackUnitByName[0].id },
          include: { project: true }
        })
      }
    }
    if (!unit && project && trimmedUnitName) {
      unit = await db.operationalUnit.findFirst({
        where: { projectId: project.id, name: { contains: trimmedUnitName, mode: "insensitive" } },
        include: { project: true }
      })
    }
    if (!unit && project && trimmedUnitName) {
      const normalizedUnitName = normalizeArabicNumerals(trimmedUnitName)
      if (normalizedUnitName !== trimmedUnitName) {
        unit = await db.operationalUnit.findFirst({
          where: {
            projectId: project.id,
            name: { contains: normalizedUnitName, mode: "insensitive" }
          },
          include: { project: true }
        })
      }
    }
  }

  if (!unit) {
    await logWebhookEvent(
      authContext.keyId,
      "TICKET_CREATED",
      "/api/webhooks/tickets",
      "POST",
      404,
      body,
      { error: "Unit not found" },
      "Unable to resolve unit from provided details",
      ipAddress
    )
    return {
      status: 404,
      data: {
        success: false,
        error: "Unable to find the specified unit",
        details: {
          project: trimmedProjectName || null,
          unitCode: requestedUnitCode || null,
          unitName: trimmedUnitName || null
        },
        humanReadable: {
          en: "Could not match the provided unit information to an existing unit.",
          ar: "تعذر العثور على وحدة مطابقة للبيانات المرسلة."
        },
        suggestions: [
          {
            title: "قائمة أكواد الوحدات",
            prompt: "اذكر لي أكواد أو أسماء الوحدات المتاحة في هذا المشروع للتأكد من الكود الصحيح.",
            data: { projectName: trimmedProjectName || null }
          }
        ]
      }
    }
  }

  if (!project) {
    project = unit.projectId
      ? await db.project.findUnique({
          where: { id: unit.projectId },
          select: { id: true, name: true }
        })
      : null
  }

  let resident: Prisma.ResidentGetPayload<{ include: { unit: { include: { project: true } } } }> | null = null
  if (callerPhone) {
    const phoneVariants = buildPhoneVariants(callerPhone)
    resident = await db.resident.findFirst({
      where: {
        unitId: unit.id,
        OR: [{ phone: { in: phoneVariants } }, { whatsappPhone: { in: phoneVariants } }]
      },
      include: { unit: { include: { project: true } } }
    })
  }
  if (!resident && trimmedResidentName) {
    resident = await db.resident.findFirst({
      where: { name: trimmedResidentName, unitId: unit.id },
      include: { unit: { include: { project: true } } }
    })
  }
  if (!resident && trimmedResidentName) {
    resident = await db.resident.create({
      data: {
        name: trimmedResidentName,
        email: (residentEmail as string) || null,
        phone: callerPhone || null,
        unitId: unit.id,
        status: "ACTIVE"
      },
      include: { unit: { include: { project: true } } }
    })
  } else if (resident && (residentEmail || callerPhone)) {
    resident = await db.resident.update({
      where: { id: resident.id },
      data: {
        ...(residentEmail && { email: residentEmail as string }),
        ...(callerPhone && !resident.phone && { phone: callerPhone })
      },
      include: { unit: { include: { project: true } } }
    })
  }

  const senderDisplayName = resident?.name ?? (trimmedResidentName || "ساكن (غير مسجل)")
  const priorityLabel = (priority || "Normal") as string

  const ticket = await db.ticket.create({
    data: {
      title: trimmedTitle,
      description: trimmedDescription || trimmedTitle,
      priority: priorityLabel,
      status: "NEW",
      source: "WHATSAPP",
      residentId: resident?.id ?? null,
      unitId: unit.id,
      isResidentKnown: !!resident,
      contactName: !resident ? (trimmedResidentName || null) : null,
      contactPhone: !resident ? (callerPhone || null) : null
    }
  })

  const ticketNumber = `TICK-${ticket.id.substring(0, 8).toUpperCase()}`
  const projectLabel = project?.name ?? unit.project?.name ?? resident?.unit?.project?.name ?? null
  const unitLabel = unit.name ? `${unit.code} • ${unit.name}` : unit.code
  const createdAtLabel = formatDate(ticket.createdAt)

  const humanReadable: HumanReadable = {
    en: `New ticket ${ticketNumber} opened by ${senderDisplayName} for unit ${unitLabel}${projectLabel ? ` in project ${projectLabel}` : ""}. Priority: ${priorityLabel}${createdAtLabel ? ` on ${createdAtLabel}` : ""}.`,
    ar: `تم فتح تذكرة جديدة ${ticketNumber} بواسطة ${senderDisplayName} للوحدة ${unitLabel}${projectLabel ? ` في مشروع ${projectLabel}` : ""}. الأولوية: ${priorityLabel}${createdAtLabel ? ` بتاريخ ${createdAtLabel}` : ""}.`
  }

  const suggestions: Suggestion[] = [
    {
      title: "تعيين فني",
      prompt: `كلف فني مناسب للتذكرة ${ticketNumber} وحدد موعد الزيارة.`,
      data: { ticketId: ticket.id, unitId: unit.id }
    },
    {
      title: "إبلاغ المُبلِّغ",
      prompt: `أرسل تأكيد للساكن ${senderDisplayName} بأن التذكرة ${ticketNumber} تحت المتابعة.`,
      data: { residentId: resident?.id ?? null, ticketNumber, contactPhone: callerPhone || null }
    }
  ]

  const meta = {
    event: "TICKET_CREATED" as const,
    projectId: unit.project?.id ?? project?.id ?? null,
    projectName: projectLabel,
    unitId: unit.id,
    unitCode: unit.code,
    priority: priorityLabel,
    createdAt: ticket.createdAt,
    residentId: resident?.id ?? null,
    isAnonymous: !resident
  }

  const response = {
    success: true,
    ticketId: ticket.id,
    ticketNumber,
    ticket: {
      id: ticket.id,
      title: trimmedTitle,
      description: trimmedDescription,
      priority: priorityLabel,
      status: "NEW",
      residentId: resident?.id ?? null,
      contactName: ticket.contactName,
      contactPhone: ticket.contactPhone,
      unitId: unit.id,
      createdAt: ticket.createdAt
    },
    resident: resident
      ? {
          id: resident.id,
          name: resident.name,
          email: resident.email,
          phone: resident.phone,
          unitCode: resident.unit.code
        }
      : null,
    anonymous: !resident ? { name: trimmedResidentName || null, phone: callerPhone || null } : null,
    unit: {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      projectId: unit.project?.id ?? project?.id ?? null,
      projectName: projectLabel
    },
    meta,
    humanReadable,
    suggestions,
    message: "Ticket created successfully"
  }

  await notifyN8nEvent("TICKET_CREATED", {
    ticket: response.ticket,
    ticketNumber,
    resident: response.resident,
    unit: response.unit,
    meta,
    humanReadable,
    suggestions
  })

  if (unit.projectId) {
    const pms = await getPMsForProject(unit.projectId)
    if (pms.length > 0) {
      await notifyN8nEvent("PM_NEW_TICKET", {
        pmPhones: pms,
        ticketNumber,
        ticket: {
          id: ticket.id,
          title: trimmedTitle,
          description: trimmedDescription || trimmedTitle,
          priority: priorityLabel,
          status: "NEW"
        },
        resident: {
          name: senderDisplayName,
          phone: resident?.phone ?? callerPhone ?? null,
          isAnonymous: !resident
        },
        unit: {
          code: unit.code,
          name: unit.name ?? null,
          projectName: unit.project?.name ?? null
        },
        humanReadable: {
          ar: `تذكرة جديدة ${ticketNumber} من ${senderDisplayName} في الوحدة ${unit.code} — ${trimmedTitle}`
        }
      })
    }
  }

  await logWebhookEvent(
    authContext.keyId,
    "TICKET_CREATED",
    "/api/webhooks/tickets",
    "POST",
    201,
    body,
    response,
    undefined,
    ipAddress
  )

  return { status: 201, data: response }
}
