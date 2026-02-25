import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"

type HumanReadable = {
  en?: string
  ar?: string
}

type Suggestion = {
  title: string
  prompt: string
  data?: Record<string, unknown>
}

function formatNumber(value: number) {
  try {
    return value.toLocaleString("en-US")
  } catch {
    return String(value)
  }
}

function formatCurrency(amount: number) {
  try {
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    })
  } catch {
    return String(amount)
  }
}

function formatDate(date: Date | string) {
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

type WebhookResponse<Data = unknown> = {
  success: true
  role: string
  type: string
  projectId?: string | null
  meta?: Record<string, unknown>
  data: Data
  message?: string
  humanReadable?: HumanReadable
  suggestions?: Suggestion[]
}

function buildWebhookResponse<Data>(options: {
  role: string
  type: string
  projectId?: string | null
  data: Data
  meta?: Record<string, unknown>
  message?: string
  humanReadable?: HumanReadable
  suggestions?: Suggestion[]
}): WebhookResponse<Data> {
  return {
    success: true,
    role: options.role,
    type: options.type,
    projectId: options.projectId ?? null,
    meta: options.meta,
    data: options.data,
    message: options.message,
    humanReadable: options.humanReadable,
    suggestions: options.suggestions
  }
}

// GET /api/webhooks/query - للاستعلامات بناء على الـ role
export async function GET(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const queryType = searchParams.get("type") || "DEFAULT"
    const senderPhone = searchParams.get("senderPhone")
    const projectNameParamRaw = searchParams.get("projectName")
    const projectNameParam = projectNameParamRaw ? projectNameParamRaw.trim() : null

    let resolvedProjectId: string | null = null
    let requestingUser: null | {
      id: string
      role: string
      canViewAllProjects: boolean
      assignedProjects: {
        projectId: string
        project: { id: string; name: string } | null
      }[]
    } = null

    if (senderPhone && auth.context.role !== "RESIDENT") {
      const phoneVariants = buildPhoneVariants(senderPhone)
      requestingUser = await db.user.findFirst({
        where: {
          role: auth.context.role,
          whatsappPhone: { in: phoneVariants }
        },
        select: {
          id: true,
          role: true,
          canViewAllProjects: true,
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

      if (!requestingUser) {
        return NextResponse.json(
          { error: "Unauthorized sender phone" },
          { status: 403 }
        )
      }

      if (auth.context.role === "PROJECT_MANAGER") {
        const assignedProjects = requestingUser.assignedProjects.map((assignment) => ({
          id: assignment.project?.id ?? assignment.projectId,
          name: assignment.project?.name ?? assignment.projectId
        }))

        const projectIdParamRaw = searchParams.get("projectId")
        const projectIdParam = projectIdParamRaw ? projectIdParamRaw.trim() : null
        resolvedProjectId = projectIdParam || auth.context.projectId || null

        if (!resolvedProjectId && projectNameParam) {
          const normalizedName = projectNameParam.toLowerCase()
          const directAssignment = requestingUser.assignedProjects.find((assignment) => {
            const assignmentName = assignment.project?.name ?? ""
            return assignmentName.trim().toLowerCase() === normalizedName
          })

          if (directAssignment) {
            resolvedProjectId = directAssignment.projectId
          } else if (requestingUser.canViewAllProjects) {
            const projectMatch = await db.project.findFirst({
              where: { name: projectNameParam },
              select: { id: true, name: true }
            })

            if (projectMatch) {
              resolvedProjectId = projectMatch.id
            } else {
              const fallbackMatches = await db.$queryRaw<{ id: string }[]>`
                SELECT "id" FROM "Project"
                WHERE LOWER("name") = LOWER(${projectNameParam})
                LIMIT 1
              `

              if (fallbackMatches.length > 0) {
                resolvedProjectId = fallbackMatches[0].id
              }
            }
          }

          if (!resolvedProjectId) {
            return NextResponse.json(
              {
                error: "Project not found for provided name",
                requestedName: projectNameParam,
                canViewAllProjects: requestingUser.canViewAllProjects,
                assignedProjects
              },
              { status: 404 }
            )
          }
        }

        if (!resolvedProjectId) {
          return NextResponse.json(
            {
              success: true,
              role: "PROJECT_MANAGER",
              requiresProjectId: !requestingUser.canViewAllProjects,
              canViewAllProjects: requestingUser.canViewAllProjects,
              assignedProjects
            },
            { status: 200 }
          )
        }

        resolvedProjectId = resolvedProjectId.trim()

        if (
          !requestingUser.canViewAllProjects &&
          !requestingUser.assignedProjects.some(
            (assignment) => assignment.projectId === resolvedProjectId
          )
        ) {
          return NextResponse.json(
            { error: "Project Manager is not assigned to this project" },
            { status: 403 }
          )
        }
      }
    }

    let responsePayload: WebhookResponse | null = null

    // ========================================
    // ACCOUNTANT QUERIES
    // ========================================
    if (auth.context.role === "ACCOUNTANT") {
      if (queryType === "ACCOUNTING_DATA" || queryType === "DEFAULT") {
        // Get all invoices, payments, and accounting data
        const invoices = await db.invoice.findMany({
          include: {
            payments: true,
            ownerAssociation: true,
            unit: true
          }
        })

        const accountingNotes = await db.accountingNote.findMany({
          where: { status: "PENDING" },
          include: {
            unit: true,
            createdByUser: true,
            project: true
          }
        })

        const totalInvoices = invoices.length
        const totalPaid = invoices.reduce(
          (sum, inv) => sum + inv.payments.reduce((s, p) => s + p.amount, 0),
          0
        )
        const totalRemaining = invoices.reduce(
          (sum, inv) => sum + (inv.amount - inv.payments.reduce((s, p) => s + p.amount, 0)),
          0
        )
        const pendingNotesCount = accountingNotes.length
        const collectionBase = totalPaid + totalRemaining
        const collectionRate = collectionBase > 0 ? Math.round((totalPaid / collectionBase) * 100) : null

        const humanReadable: HumanReadable = {
          en: `Accounting snapshot ready: ${formatNumber(totalInvoices)} invoices, ${formatCurrency(totalPaid)} collected, ${formatCurrency(totalRemaining)} outstanding${collectionRate !== null ? ` (collection rate ${collectionRate}% ).` : "."} Pending notes: ${formatNumber(pendingNotesCount)}.`,
          ar: `تم تجهيز ملخص الحسابات: ${formatNumber(totalInvoices)} فاتورة، تم تحصيل ${formatCurrency(totalPaid)}، والمتبقي ${formatCurrency(totalRemaining)}${collectionRate !== null ? ` (معدل التحصيل ${collectionRate}% ).` : "."} عدد الملاحظات المعلقة ${formatNumber(pendingNotesCount)}.`
        }

        const topPendingNote = accountingNotes[0]
        const suggestions: Suggestion[] = [
          topPendingNote
            ? {
                title: "مراجعة أول ملاحظة",
                prompt: `افتح تفاصيل الملاحظة المحاسبية ${topPendingNote.id} للوحدة ${topPendingNote.unit.code}.`,
                data: {
                  noteId: topPendingNote.id,
                  projectId: topPendingNote.projectId
                }
              }
            : undefined,
          {
            title: "قائمة الفواتير المتأخرة",
            prompt: "هات لي الفواتير التي عليها أرصدة متأخرة مرتبة من الأكبر للأصغر.",
            data: {
              focus: "aging"
            }
          }
        ].filter(Boolean) as Suggestion[]

        responsePayload = buildWebhookResponse({
          role: "ACCOUNTANT",
          type: queryType,
          data: {
            statistics: {
              totalInvoices,
              totalPaid: Math.round(totalPaid * 100) / 100,
              totalRemaining: Math.round(totalRemaining * 100) / 100
            },
            invoices: invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              type: inv.type,
              amount: inv.amount,
              unit: inv.unit.code,
              ownerAssociation: inv.ownerAssociation.name,
              totalPaid: inv.payments.reduce((s, p) => s + p.amount, 0),
              remainingBalance:
                inv.amount -
                inv.payments.reduce((s, p) => s + p.amount, 0),
              paymentCount: inv.payments.length,
              createdAt: inv.issuedAt
            })),
            pendingAccountingNotes: accountingNotes.map((note) => ({
              id: note.id,
              description: note.description,
              amount: note.amount,
              unit: note.unit.code,
              project: note.project.name,
              createdBy: note.createdByUser.name,
              createdAt: note.createdAt
            }))
          },
          humanReadable,
          suggestions
        })
      }

      // ========================================
      // ADMIN QUERIES
      // ========================================
    } else if (auth.context.role === "ADMIN") {
      if (queryType === "ALL_DATA" || queryType === "DEFAULT") {
        const [
          projects,
          operationalUnits,
          residents,
          tickets,
          invoices,
          technicians,
          staff
        ] = await Promise.all([
          db.project.findMany({
            include: { projectType: true }
          }),
          db.operationalUnit.findMany(),
          db.resident.findMany(),
          db.ticket.findMany({ include: { resident: true, unit: true } }),
          db.invoice.findMany({ include: { payments: true } }),
          db.technician.findMany({ include: { specialty: true } }),
          db.staff.findMany()
        ])

        const openTickets = tickets.filter((t) => t.status !== "DONE")
        const humanReadable: HumanReadable = {
          en: `Admin overview: ${formatNumber(projects.length)} projects, ${formatNumber(operationalUnits.length)} units, ${formatNumber(residents.length)} residents, and ${formatNumber(openTickets.length)} open tickets.`,
          ar: `نظرة عامة للإدارة: ${formatNumber(projects.length)} مشروع، ${formatNumber(operationalUnits.length)} وحدة، ${formatNumber(residents.length)} ساكن، و ${formatNumber(openTickets.length)} تذكرة مفتوحة.`
        }

        const suggestions: Suggestion[] = [
          openTickets.length
            ? {
                title: "متابعة التذاكر المفتوحة",
                prompt: "هات لي التذاكر المفتوحة مرتبة بالأولوية مع أقدمية الإنشاء.",
                data: {
                  focus: "tickets",
                  status: "OPEN"
                }
              }
            : undefined,
          {
            title: "تحليل المشاريع",
            prompt: "قارن بين المشاريع من حيث عدد الوحدات والسكان النشطين."
          }
        ].filter(Boolean) as Suggestion[]

        responsePayload = buildWebhookResponse({
          role: "ADMIN",
          type: queryType,
          data: {
            summary: {
              totalProjects: projects.length,
              totalUnits: operationalUnits.length,
              totalResidents: residents.length,
              totalTickets: tickets.length,
              openTickets: tickets.filter((t) => t.status !== "DONE").length,
              totalTechnicians: technicians.length,
              totalStaff: staff.length
            },
            projects: projects.map((p) => ({
              id: p.id,
              name: p.name,
              type: p.projectType?.name ?? null,
              isActive: p.isActive
            })),
            units: operationalUnits.map((u) => ({
              id: u.id,
              code: u.code,
              name: u.name,
              projectId: u.projectId
            })),
            residents: residents.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              phone: r.phone,
              status: r.status
            })),
            technicians: technicians.map((t) => ({
              id: t.id,
              name: t.name,
              phone: t.phone,
              specialty: t.specialty?.name ?? null
            }))
          },
          humanReadable,
          suggestions
        })
      }

      // ========================================
      // PROJECT MANAGER QUERIES
      // ========================================
    } else if (auth.context.role === "PROJECT_MANAGER") {
      const projectId = (
        resolvedProjectId ??
        searchParams.get("projectId") ??
        auth.context.projectId ??
        ""
      ).trim()

      if (!projectId) {
        return NextResponse.json(
          { error: "Project ID is required for PROJECT_MANAGER" },
          { status: 400 }
        )
      }

      if (queryType === "LAST_EXPENSE") {
        const rangeParam = searchParams.get("range")?.toUpperCase() ?? null
        const dateParam = searchParams.get("date")
        const unitFilter = searchParams.get("unit")?.trim() ?? null

        let startDate: Date | null = null
        let endDate: Date | null = null

        if (rangeParam === "TODAY") {
          startDate = new Date()
          startDate.setHours(0, 0, 0, 0)
          endDate = new Date()
          endDate.setHours(23, 59, 59, 999)
        } else if (rangeParam === "WEEK") {
          endDate = new Date()
          endDate.setHours(23, 59, 59, 999)
          startDate = new Date(endDate)
          startDate.setDate(startDate.getDate() - 6)
          startDate.setHours(0, 0, 0, 0)
        } else if (rangeParam === "MONTH") {
          endDate = new Date()
          endDate.setHours(23, 59, 59, 999)
          startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
        } else if (dateParam) {
          const parsedDate = new Date(dateParam)
          if (!Number.isNaN(parsedDate.getTime())) {
            startDate = new Date(parsedDate)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(parsedDate)
            endDate.setHours(23, 59, 59, 999)
          }
        }

        const whereClause: any = { projectId }
        if (startDate && endDate) {
          whereClause.createdAt = {
            gte: startDate,
            lte: endDate
          }
        }
        if (unitFilter) {
          whereClause.unit = {
            OR: [
              { code: unitFilter },
              { name: unitFilter }
            ]
          }
        }

        const notes = await db.accountingNote.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          include: {
            unit: {
              select: {
                id: true,
                code: true,
                name: true
              }
            },
            createdByUser: {
              select: {
                id: true,
                name: true
              }
            }
          },
          take: rangeParam === "TODAY" || dateParam ? 10 : 50
        })

        const totalAmount = notes.reduce((sum, note) => sum + note.amount, 0)
        const periodLabel = rangeParam || (dateParam ? `DATE ${dateParam}` : "ALL TIME")
        const humanReadable: HumanReadable = notes.length
          ? {
              en: `Found ${formatNumber(notes.length)} expense note${notes.length === 1 ? "" : "s"} for filters (${periodLabel}) totaling ${formatCurrency(totalAmount)}.`,
              ar: `تم العثور على ${formatNumber(notes.length)} من ملاحظات المصروفات حسب الفلاتر (${periodLabel}) بإجمالي ${formatCurrency(totalAmount)}.`
            }
          : {
              en: `No expenses matched the filters (${periodLabel}).`,
              ar: `لا توجد مصروفات مطابقة للفلاتر (${periodLabel}).`
            }

        const topNote = notes[0]
        const suggestions: Suggestion[] = notes.length
          ? [
              topNote
                ? {
                    title: "تفاصيل أحدث مصروف",
                    prompt: `هات تفاصيل الملاحظة ${topNote.id} مع مَن سجلها والوحدة الخاصة بها.`,
                    data: {
                      noteId: topNote.id,
                      unitCode: topNote.unit.code
                    }
                  }
                : undefined,
              {
                title: "مقارنة بالمقدم",
                prompt: "قارن إجمالي المصروفات مع رصيد مقدم المدير الحالي."
              }
            ].filter(Boolean) as Suggestion[]
          : [
              {
                title: "توسيع نطاق البحث",
                prompt: "جرّب عرض مصروفات الأسبوع أو الشهر لو لقيت اليوم فاضي.",
                data: {
                  currentRange: rangeParam,
                  unit: unitFilter
                }
              }
            ]

        const response = buildWebhookResponse({
          role: "PROJECT_MANAGER",
          type: queryType,
          projectId,
          meta: {
            filters: {
              range: rangeParam,
              date: dateParam,
              unit: unitFilter
            },
            count: notes.length
          },
          data: {
            expenses: notes.map((note) => ({
              noteId: note.id,
              amount: note.amount,
              description: note.description,
              status: note.status,
              createdAt: note.createdAt,
              unit: note.unit,
              createdBy: note.createdByUser
            })),
            totalAmount
          },
          message: notes.length === 0 ? "لا توجد مصروفات مطابقة للمعايير المدخلة" : undefined,
          humanReadable,
          suggestions
        })

        await logWebhookEvent(
          auth.context.keyId,
          "QUERY_EXECUTED",
          "/api/webhooks/query",
          "GET",
          200,
          {
            type: queryType,
            projectId,
            range: rangeParam,
            date: dateParam,
            unit: unitFilter
          },
          response,
          undefined,
          ipAddress
        )

        return NextResponse.json(response)
      }

      if (queryType === "PROJECT_DATA" || queryType === "DEFAULT") {
        const [project, units, residents, tickets, technicians, staff] =
          await Promise.all([
            db.project.findUnique({ where: { id: projectId }, include: { projectType: true } }),
            db.operationalUnit.findMany({ where: { projectId } }),
            db.resident.findMany({
              where: {
                unit: { projectId }
              }
            }),
            db.ticket.findMany({
              where: {
                unit: { projectId }
              },
              include: { resident: true, unit: true }
            }),
            db.technician.findMany({ include: { specialty: true } }),
            db.staff.findMany({
              where: {
                unit: { projectId }
              }
            })
          ])

        const openTicketsCount = tickets.filter((t) => t.status !== "DONE").length
        const humanReadable: HumanReadable = {
          en: `Project dashboard: ${project?.name ?? "Unknown"} has ${formatNumber(units.length)} units, ${formatNumber(residents.length)} residents, and ${formatNumber(openTicketsCount)} open tickets.`,
          ar: `لوحة المشروع: ${project?.name ?? "غير معروف"} يحتوي على ${formatNumber(units.length)} وحدة، ${formatNumber(residents.length)} ساكن، و ${formatNumber(openTicketsCount)} تذكرة مفتوحة.`
        }

        const suggestions: Suggestion[] = [
          {
            title: "أعلى الوحدات ضغطاً",
            prompt: "حلل الوحدات التي لديها أكبر عدد من التذاكر المفتوحة."
          },
          residents.length
            ? {
                title: "تواصل مع السكان",
                prompt: "جهز رسالة للسكان لإبلاغهم بآخر تحديثات المشروع."
              }
            : undefined
        ].filter(Boolean) as Suggestion[]

        responsePayload = buildWebhookResponse({
          role: "PROJECT_MANAGER",
          type: queryType,
          projectId,
          data: {
            project: {
              id: project?.id,
              name: project?.name,
              type: project?.projectType?.name ?? null
            },
            summary: {
              totalUnits: units.length,
              totalResidents: residents.length,
              openTickets: tickets.filter((t) => t.status !== "DONE").length,
              totalTickets: tickets.length,
              totalTechnicians: technicians.length,
              totalStaff: staff.length
            },
            units: units.map((u) => ({
              id: u.id,
              code: u.code,
              name: u.name
            })),
            residents: residents.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              phone: r.phone,
              unit: r.unitId
            })),
            openTickets: tickets
              .filter((t) => t.status !== "DONE")
              .map((t) => ({
                id: t.id,
                title: t.title,
                unit: t.unit.code,
                resident: t.resident?.name ?? null,
                status: t.status,
                priority: t.priority
              })),
            technicians: technicians.map((t) => ({
              id: t.id,
              name: t.name,
              phone: t.phone,
              specialty: t.specialty?.name ?? null
            })),
            staff: staff.map((s) => ({
              id: s.id,
              name: s.name,
              role: s.role,
              phone: s.phone
            }))
          },
          humanReadable,
          suggestions
        })
      }

      if (queryType === "TICKET_BY_RESIDENT") {
        const residentInput = searchParams.get("resident")?.trim()

        if (!residentInput) {
          return NextResponse.json(
            {
              error: "Missing resident identifier",
              hint: "Provide resident name or phone"
            },
            { status: 400 }
          )
        }

        const phoneVariants = buildPhoneVariants(residentInput)
        const residentOr: any[] = [{ name: residentInput }]
        if (phoneVariants.length > 0) {
          residentOr.unshift({ phone: { in: phoneVariants } })
        }

        const residentMatch = await db.resident.findFirst({
          where: {
            unit: { projectId },
            OR: residentOr
          },
          include: {
            unit: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        })

        if (!residentMatch) {
          const response = buildWebhookResponse({
            role: "PROJECT_MANAGER",
            type: queryType,
            projectId,
            data: {
              resident: null,
              tickets: []
            },
            message: "لم يتم العثور على مقيم بهذه البيانات",
            humanReadable: {
              en: `No resident matched "${residentInput}" in this project.`,
              ar: `لا يوجد ساكن مطابق لـ "${residentInput}" في هذا المشروع.`
            },
            suggestions: [
              {
                title: "تأكيد بيانات الساكن",
                prompt: "راجع اسم الساكن أو جرب رقم الهاتف بالكامل بما في ذلك كود الدولة.",
                data: {
                  searchTerm: residentInput
                }
              }
            ]
          })

          await logWebhookEvent(
            auth.context.keyId,
            "QUERY_EXECUTED",
            "/api/webhooks/query",
            "GET",
            200,
            { type: queryType, projectId, resident: residentInput },
            response,
            undefined,
            ipAddress
          )

          return NextResponse.json(response)
        }

        const residentTickets = await db.ticket.findMany({
          where: { residentId: residentMatch.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            unit: true,
            assignedTo: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })

        const response = buildWebhookResponse({
          role: "PROJECT_MANAGER",
          type: queryType,
          projectId,
          meta: {
            residentId: residentMatch.id,
            ticketCount: residentTickets.length
          },
          data: {
            resident: {
              id: residentMatch.id,
              name: residentMatch.name,
              phone: residentMatch.phone,
              unit: residentMatch.unit
            },
            tickets: residentTickets.map((ticket) => ({
              id: ticket.id,
              title: ticket.title,
              description: ticket.description,
              status: ticket.status,
              priority: ticket.priority,
              createdAt: ticket.createdAt,
              closedAt: ticket.closedAt,
              unit: {
                id: ticket.unit.id,
                code: ticket.unit.code,
                name: ticket.unit.name
              },
              assignedTo: ticket.assignedTo
            }))
          },
          humanReadable: residentTickets.length
            ? {
                en: `Resident ${residentMatch.name ?? "N/A"} has ${formatNumber(residentTickets.length)} ticket${residentTickets.length === 1 ? "" : "s"}.`,
                ar: `الساكن ${residentMatch.name ?? "غير معروف"} لديه ${formatNumber(residentTickets.length)} تذكرة.`
              }
            : {
                en: `Resident ${residentMatch.name ?? "N/A"} has no tickets.`,
                ar: `الساكن ${residentMatch.name ?? "غير معروف"} لا يملك تذاكر.`
              },
          suggestions: residentTickets.length
            ? [
                {
                  title: "متابعة آخر تذكرة",
                  prompt: `هات تحديث للتذكرة ${residentTickets[0].id} وأين وصلت حتى الآن.`,
                  data: {
                    ticketId: residentTickets[0].id
                  }
                },
                {
                  title: "تنبيه الساكن",
                  prompt: `اكتب رسالة للساكن ${residentMatch.name ?? ""} بخصوص حالة التذكرة الحالية.`,
                  data: {
                    residentId: residentMatch.id
                  }
                }
              ]
            : [
                {
                  title: "فتح تذكرة جديدة",
                  prompt: "أنشئ تذكرة خدمة جديدة لهذا الساكن."
                }
              ]
        })

        await logWebhookEvent(
          auth.context.keyId,
          "QUERY_EXECUTED",
          "/api/webhooks/query",
          "GET",
          200,
          { type: queryType, projectId, resident: residentInput },
          response,
          undefined,
          ipAddress
        )

        return NextResponse.json(response)
      }

      if (queryType === "TODAY_TICKETS") {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)

        const tickets = await db.ticket.findMany({
          where: {
            unit: { projectId },
            createdAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          include: { resident: true, unit: true }
        })

        const humanReadable: HumanReadable = tickets.length
          ? {
              en: `Logged ${formatNumber(tickets.length)} ticket${tickets.length === 1 ? "" : "s"} today for the project.`,
              ar: `تم تسجيل ${formatNumber(tickets.length)} تذكرة اليوم للمشروع.`
            }
          : {
              en: "No new tickets were created today.",
              ar: "لم يتم إنشاء تذاكر جديدة اليوم."
            }

        const suggestions: Suggestion[] = tickets.length
          ? [
              {
                title: "تحديد أعلى أولوية",
                prompt: "هات التذاكر ذات الأولوية العالية بين تذاكر اليوم."
              },
              {
                title: "التواصل مع السكان",
                prompt: "جهز رسائل للسكان الذين فتحوا تذاكر اليوم لإبلاغهم بآخر المستجدات."
              }
            ]
          : [
              {
                title: "مراجعة التذاكر السابقة",
                prompt: "اعرض التذاكر المفتوحة من الأيام السابقة لمتابعتها."
              }
            ]

        responsePayload = buildWebhookResponse({
          role: "PROJECT_MANAGER",
          type: queryType,
          projectId,
          meta: {
            date: startOfDay.toISOString().substring(0, 10),
            count: tickets.length
          },
          data: {
            tickets: tickets.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              priority: t.priority,
              status: t.status,
              resident: t.resident?.name ?? null,
              residentPhone: t.resident?.phone ?? null,
              unit: t.unit.code,
              unitName: t.unit.name,
              createdAt: t.createdAt
            }))
          },
          humanReadable,
          suggestions
        })
      }

      // ========================================
      // RESIDENT QUERIES (Limited)
      // ========================================
    } else if (auth.context.role === "RESIDENT") {
      // Residents can only query their own tickets
      if (queryType === "MY_TICKETS" || queryType === "DEFAULT") {
        // Get resident from email/phone (would need to implement this properly)
        responsePayload = buildWebhookResponse({
          role: "RESIDENT",
          type: queryType,
          data: {},
          message:
            "Residents cannot query via webhooks. Please use the dashboard.",
          humanReadable: {
            en: "Please use the resident dashboard to check your tickets.",
            ar: "من فضلك استخدم لوحة الساكن لمراجعة تذاكرك."
          },
          suggestions: [
            {
              title: "فتح لوحة الساكن",
              prompt: "افتح لوحة الساكن وسجل الدخول لمتابعة التذاكر."
            }
          ]
        })
      }
    }

    const response =
      responsePayload ??
      buildWebhookResponse({
        role: auth.context.role,
        type: queryType,
        data: {},
        message: "No data available for this query",
        humanReadable: {
          en: "No records matched this query.",
          ar: "لا توجد نتائج للاستعلام المطلوب."
        },
        suggestions: [
          {
            title: "تعديل الاستعلام",
            prompt: "غيّر نوع الاستعلام أو أضف محددات مختلفة لعرض بيانات أخرى."
          }
        ]
      })

    const auditContext: Record<string, unknown> = { type: queryType }
    if (response.projectId) {
      auditContext.projectId = response.projectId
    }

    await logWebhookEvent(
      auth.context.keyId,
      "QUERY_EXECUTED",
      "/api/webhooks/query",
      "GET",
      200,
      auditContext,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error executing query:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "QUERY_EXECUTED",
        "/api/webhooks/query",
        "GET",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      { error: "Failed to execute query" },
      { status: 500 }
    )
  }
}
