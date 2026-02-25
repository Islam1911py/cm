import { NextRequest, NextResponse } from "next/server"

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import {
  analyzeExpenseSearch,
  buildDescriptionFilter,
  EXPENSE_SOURCE_TYPES,
  parseExpenseFilterDsl,
  type ExpenseSourceType
} from "@/lib/expense-search"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"

const ENDPOINT = "/api/webhooks/project-managers"

const ALLOWED_ACTIONS = [
  "CREATE_OPERATIONAL_EXPENSE",
  "GET_RESIDENT_PHONE",
  "LIST_PROJECT_TICKETS",
  "LIST_PROJECT_UNITS",
  "LIST_UNIT_EXPENSES",
  "GET_LAST_ELECTRICITY_TOPUP"
] as const

type AllowedAction = (typeof ALLOWED_ACTIONS)[number]

type ActionMap = {
  CREATE_OPERATIONAL_EXPENSE: {
    projectId: string
    unitCode: string
    description: string
    amount: number | string
    sourceType: "OFFICE_FUND" | "PM_ADVANCE"
    pmAdvanceId?: string | null
    recordedAt?: string | null
  }
  GET_RESIDENT_PHONE: {
    projectId: string
    unitCode: string
    residentName?: string | null
    limit?: number | string
  }
  LIST_PROJECT_TICKETS: {
    projectId: string
    unitCode?: string | null
    statuses?: string[]
    limit?: number | string
  }
  LIST_PROJECT_UNITS: {
    projectId: string
    includeInactive?: boolean
    limit?: number | string
    search?: string | null
  }
  LIST_UNIT_EXPENSES: {
    projectId?: string | null
    projectName?: string | null
    unitCode?: string | null
    limit?: number | string
    sourceTypes?: Array<
      "TECHNICIAN_WORK" | "STAFF_WORK" | "ELECTRICITY" | "OTHER"
    >
    search?: string | null
    fromDate?: string | null
    toDate?: string | null
    filterDsl?: string | null
  }
  GET_LAST_ELECTRICITY_TOPUP: {
    projectId: string
    unitCode?: string | null
  }
}

type RequestBody = {
  action?: string
  senderPhone?: string
  payload?: Record<string, unknown>
}

type ManagerRecord = NonNullable<Awaited<ReturnType<typeof resolveProjectManager>>>

type HumanReadable = {
  ar?: string
}

type Suggestion = {
  title: string
  prompt: string
  data?: Record<string, unknown>
}

type ActionSuccessPayload<Data = unknown> = {
  success: true
  projectId?: string | null
  data: Data
  meta?: Record<string, unknown>
  message?: string
  humanReadable?: HumanReadable
  suggestions?: Suggestion[]
}

type ActionErrorPayload = {
  success: false
  error: string
  issues?: Record<string, unknown>
  projectId?: string | null
  meta?: Record<string, unknown>
  humanReadable?: HumanReadable
  suggestions?: Suggestion[]
}

type HandlerResponse = {
  status: number
  body: ActionSuccessPayload | ActionErrorPayload
}

type ActionHandler<K extends AllowedAction> = (
  manager: ManagerRecord,
  payload: ActionMap[K]
) => Promise<HandlerResponse>

type GenericActionHandler = (
  manager: ManagerRecord,
  payload: Record<string, unknown>
) => Promise<HandlerResponse>

const SOURCE_TYPE_LABELS: Record<ExpenseSourceType, string> = {
  TECHNICIAN_WORK: "أعمال فنية",
  STAFF_WORK: "أعمال موظفين",
  ELECTRICITY: "كهرباء",
  OTHER: "مصروفات أخرى"
}

type UnitExpenseWithRelations = Prisma.UnitExpenseGetPayload<{
  include: {
    unit: {
      select: {
        id: true
        code: true
        name: true
      }
    }
    recordedByUser: {
      select: {
        id: true
        name: true
      }
    }
    pmAdvance: {
      select: {
        id: true
        amount: true
        remainingAmount: true
      }
    }
  }
}>

function buildManagerContext(manager: ManagerRecord) {
  return {
    id: manager.id,
    name: manager.name,
    phone: manager.whatsappPhone,
    canViewAllProjects: manager.canViewAllProjects,
    projects: manager.canViewAllProjects
      ? []
      : manager.assignedProjects.map((assignment) => ({
          id: assignment.projectId,
          name: assignment.project?.name ?? null
        }))
  }
}

function parseLimit(input: unknown, fallback = 5, max = 25) {
  const numeric = Number(input)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback
  }
  return Math.min(Math.trunc(numeric), max)
}

function parseDateInput(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be an ISO date string`)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid; use YYYY-MM-DD`)
  }

  return parsed
}

function buildDateRangeLabel(fromDate: Date | null, toDate: Date | null) {
  if (!fromDate && !toDate) {
    return ""
  }

  const fromLabel = fromDate ? formatDate(fromDate) : null
  const toLabel = toDate ? formatDate(toDate) : null

  if (fromLabel && toLabel) {
    return ` بين ${fromLabel} و ${toLabel}`
  }
  if (fromLabel) {
    return ` منذ ${fromLabel}`
  }
  if (toLabel) {
    return ` حتى ${toLabel}`
  }

  return ""
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

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return null
  }

  try {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })
  } catch {
    return date.toISOString().split("T")[0] ?? null
  }
}

function toNumericAmount(value: unknown) {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number((value as { toString(): string }).toString())
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatSourceTypeLabel(type: ExpenseSourceType) {
  return SOURCE_TYPE_LABELS[type] ?? type
}

function buildExpenseLines(expenses: UnitExpenseWithRelations[]) {
  return expenses.slice(0, Math.min(expenses.length, 10)).map((expense) => {
    const unitLabel = expense.unit?.code ?? expense.unit?.name ?? "—"
    const description = expense.description || "(بدون وصف)"
    const amountLabel = formatCurrency(toNumericAmount(expense.amount ?? 0))
    const sourceLabel = formatSourceTypeLabel(expense.sourceType as ExpenseSourceType)
    const recordedBy = expense.recordedByUser?.name
    const recordedByLabel = recordedBy ?? "غير معروف"
    const dateLabel = formatDate(expense.date)
    return `• ${dateLabel ?? "—"} • ${unitLabel} — ${description} • ${amountLabel} (${sourceLabel}) بواسطة ${recordedByLabel}`
  })
}

async function resolveProjectManager(senderPhone: string) {
  const phoneVariants = buildPhoneVariants(senderPhone)

  if (phoneVariants.length === 0) {
    return null
  }

  return db.user.findFirst({
    where: {
      role: "PROJECT_MANAGER",
      whatsappPhone: { in: phoneVariants }
    },
    include: {
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
}

function assertProjectAccess(
  manager: ManagerRecord | null,
  projectId: string
) {
  if (!manager) {
    return false
  }

  if (manager.canViewAllProjects) {
    return true
  }

  const assigned = manager.assignedProjects?.map((assignment) => assignment.projectId) ?? []
  return assigned.includes(projectId)
}

async function handleCreateOperationalExpense(
  manager: ManagerRecord,
  payload: ActionMap["CREATE_OPERATIONAL_EXPENSE"]
): Promise<HandlerResponse> {
  const { projectId, unitCode, description, amount, sourceType, pmAdvanceId, recordedAt } = payload

  const normalizedDescription = String(description ?? "").trim()
  const numericAmount = Number(amount)

  if (!projectId || !unitCode || !normalizedDescription || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Missing or invalid fields for operational expense",
        projectId: projectId || null,
        humanReadable: {
          ar: "لم أستطع تسجيل المصروف لأن بعض البيانات ناقصة أو غير صحيحة."
        },
        suggestions: [
          {
            title: "إرسال بيانات المصروف كاملة",
            prompt: "من فضلك أعد إرسال رقم المشروع، كود الوحدة، وصف واضح، قيمة موجبة، وحدد المصدر OFFICE_FUND أو PM_ADVANCE.",
            data: {
              requiredFields: ["projectId", "unitCode", "description", "amount", "sourceType"]
            }
          }
        ]
      }
    }
  }

  if (sourceType !== "OFFICE_FUND" && sourceType !== "PM_ADVANCE") {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid sourceType. Use OFFICE_FUND or PM_ADVANCE",
        projectId,
        humanReadable: {
          ar: "المصدر يجب أن يكون OFFICE_FUND أو PM_ADVANCE."
        },
        suggestions: [
          {
            title: "ضبط نوع المصدر",
            prompt: "استخدم OFFICE_FUND للمصروفات من الخزنة أو PM_ADVANCE للمقدم الخاص بالمدير.",
            data: {
              acceptedValues: ["OFFICE_FUND", "PM_ADVANCE"]
            }
          }
        ]
      }
    }
  }

  const project = await db.project.findUnique({ where: { id: projectId } })

  if (!project) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Project not found",
        projectId,
        humanReadable: {
          ar: "لم أجد هذا المشروع لذلك لم يتم تسجيل المصروف."
        },
        suggestions: [
          {
            title: "تأكيد رقم المشروع",
            prompt: "تأكد من رقم المشروع ثم أعد طلب تسجيل المصروف.",
            data: {
              attemptedProjectId: projectId
            }
          }
        ]
      }
    }
  }

  if (!assertProjectAccess(manager, projectId)) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Project manager is not assigned to this project",
        projectId,
        humanReadable: {
          ar: "أنت غير مكلّف بهذا المشروع لذلك أوقفت تسجيل المصروف."
        },
        suggestions: [
          {
            title: "طلب صلاحية المشروع",
            prompt: "من فضلك اطلب إضافة المشروع إلى صلاحياتي ثم أعد تسجيل المصروف.",
            data: {
              managerId: manager.id,
              projectId
            }
          }
        ]
      }
    }
  }

  const unit = await db.operationalUnit.findFirst({
    where: {
      projectId,
      code: unitCode
    }
  })

  if (!unit) {
    const availableUnits = await db.operationalUnit.findMany({
      where: { projectId },
      select: {
        code: true,
        name: true
      },
      orderBy: { code: "asc" },
      take: 10
    })

    const hasAvailableUnits = availableUnits.length > 0
    const formattedUnitsList = availableUnits
      .map((candidate) => {
        const label = candidate.name ? `${candidate.code} — ${candidate.name}` : candidate.code
        return `• ${label}`
      })
      .join("\n")

    return {
      status: 404,
      body: {
        success: false,
        error: "Operational unit not found for provided code",
        projectId,
        issues: { unitCode },
        humanReadable: {
          ar: hasAvailableUnits
            ? `مش لاقي وحدة بالكود ${unitCode} في المشروع. دي الوحدات المتاحة عندي:\n${formattedUnitsList}`
            : `مش لاقي وحدة بالكود ${unitCode} في المشروع.`
        },
        suggestions: [
          {
            title: "اختيار كود صحيح",
            prompt: hasAvailableUnits
              ? "اختر كود من الوحدات اللي فوق وابعتلي الطلب تاني بالمعلومة الصحيحة."
              : "اذكر لي كود وحدة صحيح في هذا المشروع لو متوفر عندك.",
            data: {
              projectId,
              attemptedUnitCode: unitCode,
              availableUnits
            }
          }
        ]
      }
    }
  }

  let connectedPmAdvanceId: string | null = null
  let pmAdvanceRemaining: number | undefined

  if (sourceType === "PM_ADVANCE") {
    if (!pmAdvanceId) {
      return {
        status: 400,
        body: {
          success: false,
          error: "pmAdvanceId is required for PM_ADVANCE source",
          projectId,
          issues: { sourceType },
          humanReadable: {
            ar: "من فضلك حدد أي مقدم خاص بالمدير سيموّل هذا المصروف."
          },
          suggestions: [
            {
              title: "استعراض مقدمات المدير",
              prompt: "اعرض لي المقدمات المتاحة للمدير لهذا المشروع.",
              data: {
                projectId,
                managerId: manager.id
              }
            }
          ]
        }
      }
    }

    const pmAdvance = await db.pMAdvance.findUnique({
      where: { id: pmAdvanceId }
    })

    if (!pmAdvance) {
      return {
        status: 404,
        body: {
          success: false,
          error: "PM advance not found",
          projectId,
          issues: { pmAdvanceId },
          humanReadable: {
            ar: "تعذر العثور على المقدم المحدد."
          },
          suggestions: [
            {
              title: "اختيار مقدم صحيح",
              prompt: "من فضلك استخدم معرف مقدم صحيح مرتبط بالمشروع الحالي.",
              data: {
                attemptedPmAdvanceId: pmAdvanceId
              }
            }
          ]
        }
      }
    }

    if (pmAdvance.projectId && pmAdvance.projectId !== projectId) {
      return {
        status: 403,
        body: {
          success: false,
          error: "PM advance does not belong to the provided project",
          projectId,
          issues: { pmAdvanceProjectId: pmAdvance.projectId },
          humanReadable: {
            ar: "هذا المقدم مرتبط بمشروع آخر."
          },
          suggestions: [
            {
              title: "تحديد مشروع المقدم",
              prompt: "اذكر لي المقدمات المرتبطة بالمشروع المطلوب.",
              data: {
                projectId,
                pmAdvanceProjectId: pmAdvance.projectId
              }
            }
          ]
        }
      }
    }

    if (pmAdvance.remainingAmount < numericAmount) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Insufficient PM advance remaining balance",
          projectId,
          issues: {
            remaining: pmAdvance.remainingAmount,
            requested: numericAmount
          },
          humanReadable: {
            ar: `المتبقي في المقدم ${formatCurrency(pmAdvance.remainingAmount)} وهو أقل من المطلوب ${formatCurrency(numericAmount)}.`
          },
          suggestions: [
            {
              title: "إبلاغ المدير بالمتبقي",
              prompt: `أخبر المدير أن المتبقي في المقدم هو ${formatCurrency(pmAdvance.remainingAmount)} فقط.`,
              data: {
                remaining: pmAdvance.remainingAmount,
                requested: numericAmount
              }
            }
          ]
        }
      }
    }

    pmAdvanceRemaining = pmAdvance.remainingAmount - numericAmount

    connectedPmAdvanceId = pmAdvance.id
  }

  let recordedAtDate: Date | undefined
  if (recordedAt) {
    const parsed = new Date(recordedAt)
    if (Number.isNaN(parsed.getTime())) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Invalid recordedAt value",
          projectId,
          issues: { recordedAt },
          humanReadable: {
            ar: "تاريخ التسجيل غير صالح. استخدم صيغة مثل 2024-05-01."
          },
          suggestions: [
            {
              title: "تصحيح التاريخ",
              prompt: "استخدم تاريخ بصيغة YYYY-MM-DD عند تسجيل المصروف.",
              data: {
                attemptedRecordedAt: recordedAt
              }
            }
          ]
        }
      }
    }
    recordedAtDate = parsed
  }

  const accountingNote = await db.accountingNote.create({
    data: {
      projectId,
      unitId: unit.id,
      createdByUserId: manager.id,
      description: normalizedDescription,
      amount: numericAmount,
      status: "PENDING",
      sourceType,
      pmAdvanceId: sourceType === "PM_ADVANCE" ? connectedPmAdvanceId : null
    },
    include: {
      unit: {
        include: {
          project: true
        }
      },
      project: true,
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      pmAdvance: {
        include: {
          staff: {
            select: { id: true, name: true }
          }
        }
      }
    }
  })

  const amountLabel = formatCurrency(accountingNote.amount)
  const unitDisplay = accountingNote.unit.name
    ? `${accountingNote.unit.code} • ${accountingNote.unit.name}`
    : accountingNote.unit.code
  const projectName = accountingNote.project?.name ?? accountingNote.unit.project?.name ?? null
  const sourceLabelAr = sourceType === "PM_ADVANCE" ? "مقدم المدير" : "خزنة المكتب"
  const recordedDateLabel = formatDate(recordedAtDate ?? accountingNote.createdAt)

  const humanReadable: HumanReadable = {
    ar: `تم إنشاء مذكرة محاسبية بقيمة ${amountLabel} للوحدة ${unitDisplay}${projectName ? ` ضمن مشروع ${projectName}` : ""} من ${sourceLabelAr}. بانتظار مراجعة المحاسب${recordedDateLabel ? ` (أُرسلت ${recordedDateLabel})` : ""}.`
  }

  const suggestions: Suggestion[] = [
    {
      title: "متابعة حالة المذكرة",
      prompt: "ما حالة المذكرة المحاسبية الأخيرة التي سجلتها؟",
      data: {
        projectId,
        unitCode
      }
    }
  ]

  return {
    status: 201,
    body: {
      success: true,
      projectId,
      message: "Accounting note submitted",
      meta: {
        unitCode,
        sourceType,
        pmAdvanceRemaining
      },
      data: {
        accountingNote
      },
      humanReadable,
      suggestions
    }
  }
}

async function handleResidentLookup(
  manager: ManagerRecord,
  payload: ActionMap["GET_RESIDENT_PHONE"]
): Promise<HandlerResponse> {
  const { projectId, unitCode, residentName, limit } = payload

  if (!projectId || !unitCode) {
    return {
      status: 400,
      body: {
        success: false,
        error: "projectId and unitCode are required",
        projectId: projectId || null,
        humanReadable: {
          ar: "من فضلك أرسل رقم المشروع وكود الوحدة حتى أستطيع العثور على السكان."
        },
        suggestions: [
          {
            title: "تهيئة طلب الاستعلام",
            prompt: "استخدم رقم المشروع وكود الوحدة معاً عندما تطلب بيانات السكان.",
            data: {
              requiredFields: ["projectId", "unitCode"]
            }
          }
        ]
      }
    }
  }

  if (!assertProjectAccess(manager, projectId)) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Project manager is not assigned to this project",
        projectId,
        humanReadable: {
          ar: "أنت غير مكلّف بهذا المشروع لذلك لا يمكنني مشاركة بيانات سكانه."
        },
        suggestions: [
          {
            title: "طلب إضافة المشروع",
            prompt: "اطلب إضافة هذا المشروع لصلاحياتي ثم حاول مرة أخرى."
          }
        ]
      }
    }
  }

  const unit = await db.operationalUnit.findFirst({
    where: {
      projectId,
      code: unitCode
    }
  })

  if (!unit) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Operational unit not found",
        projectId,
        issues: { unitCode },
        humanReadable: {
          ar: "لم أجد وحدة بهذا الكود داخل المشروع."
        },
        suggestions: [
          {
            title: "عرض أكواد الوحدات",
            prompt: "اذكر لي أكواد الوحدات المتاحة في هذا المشروع.",
            data: {
              projectId
            }
          }
        ]
      }
    }
  }

  const take = parseLimit(limit, 5, 20)

  const residents = await db.resident.findMany({
    where: {
      unitId: unit.id,
      ...(residentName
        ? {
            name: {
              contains: residentName
            }
          }
        : {})
    },
    select: {
      id: true,
      name: true,
      phone: true,
      whatsappPhone: true
    },
    orderBy: { name: "asc" },
    take
  })

  const namesSample = residents.slice(0, 3).map((resident) => resident.name ?? "ساكن بدون اسم")
  const firstResident = residents[0]
  const humanReadable: HumanReadable = residents.length
    ? {
        ar: `تم العثور على ${residents.length} من السكان في الوحدة ${unitCode}: ${namesSample.join("، ")}.`
      }
    : {
        ar: `لم يتم العثور على سكان للوحدة ${unitCode}.`
      }

  const suggestions: Suggestion[] = residents.length
    ? [
        firstResident
          ? {
              title: `التواصل مع ${firstResident.name ?? "أول ساكن"}`,
              prompt: `جهز رسالة واتساب إلى ${firstResident.name ?? "السكان"} على الرقم ${firstResident.whatsappPhone ?? firstResident.phone}.`,
              data: {
                residentId: firstResident.id,
                phone: firstResident.whatsappPhone ?? firstResident.phone
              }
            }
          : undefined,
        {
          title: "عرض جميع السكان",
          prompt: `اعرض جميع السكان في الوحدة ${unitCode} ببيانات الاتصال الخاصة بهم.`,
          data: {
            projectId,
            unitCode
          }
        }
      ].filter(Boolean) as Suggestion[]
    : [
        {
          title: "مراجعة كود الوحدة",
          prompt: "تأكد من كود الوحدة أو جرب وحدة أخرى في نفس المشروع.",
          data: {
            projectId,
            unitCode
          }
        }
      ]

  return {
    status: 200,
    body: {
      success: true,
      projectId,
      meta: {
        unitCode,
        count: residents.length
      },
      data: {
        residents
      },
      message: residents.length === 0 ? "لا توجد بيانات سكان للوحدة" : undefined,
      humanReadable,
      suggestions
    }
  }
}

async function handleTicketSummary(
  manager: ManagerRecord,
  payload: ActionMap["LIST_PROJECT_TICKETS"]
): Promise<HandlerResponse> {
  const { projectId, unitCode, statuses, limit } = payload

  if (!projectId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "projectId is required",
        projectId: null,
        humanReadable: {
          ar: "أحتاج رقم المشروع لمراجعة التذاكر الخاصة به."
        },
        suggestions: [
          {
            title: "إرسال رقم المشروع",
            prompt: "ضمّن رقم المشروع عندما تطلب ملخص التذاكر."
          }
        ]
      }
    }
  }

  if (!assertProjectAccess(manager, projectId)) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Project manager is not assigned to this project",
        projectId,
        humanReadable: {
          ar: "أنت غير مكلّف بهذا المشروع لذلك لا يمكنني مشاركة التذاكر الخاصة به."
        },
        suggestions: [
          {
            title: "طلب إضافة المشروع",
            prompt: "اطلب إضافة المشروع لصلاحياتي ثم أعد طلب ملخص التذاكر."
          }
        ]
      }
    }
  }

  const validStatuses = Array.isArray(statuses)
    ? statuses.filter((status): status is "NEW" | "IN_PROGRESS" | "DONE" =>
        status === "NEW" || status === "IN_PROGRESS" || status === "DONE"
      )
    : []

  const take = parseLimit(limit, 5, 20)

  const tickets = await db.ticket.findMany({
    where: {
      unit: {
        projectId,
        ...(unitCode ? { code: unitCode } : {})
      },
      ...(validStatuses.length > 0 ? { status: { in: validStatuses } } : {})
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      unit: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take
  })

  const statusCounts = tickets.reduce(
    (acc, ticket) => {
      acc.total += 1
      acc[ticket.status] = (acc[ticket.status] ?? 0) + 1
      return acc
    },
    { total: 0, NEW: 0, IN_PROGRESS: 0, DONE: 0 } as Record<string, number>
  )

  const scopeLabel = unitCode ? `unit ${unitCode}` : "all units"
  const filteredStatusesLabel = validStatuses.length ? validStatuses.join(", ") : "all statuses"
  const firstTicket = tickets[0]

  const humanReadable: HumanReadable = tickets.length
    ? {
        ar: `تم العثور على ${tickets.length} تذكرة لـ ${unitCode ? `الوحدة ${unitCode}` : "جميع الوحدات"} (${filteredStatusesLabel}). جديد: ${statusCounts.NEW}، قيد التنفيذ: ${statusCounts.IN_PROGRESS}، منجز: ${statusCounts.DONE}.`
      }
    : {
        ar: `لا توجد تذاكر مطابقة للمحددات لـ ${unitCode ? `الوحدة ${unitCode}` : "المشروع"}.`
      }

  const suggestions: Suggestion[] = tickets.length
    ? [
        firstTicket
          ? {
              title: "متابعة أول تذكرة",
              prompt: `أعطني تفاصيل التذكرة ${firstTicket.id} مع آخر تحديث لها.`,
              data: {
                ticketId: firstTicket.id,
                status: firstTicket.status
              }
            }
          : undefined,
        {
          title: "تلخيص الحالات",
          prompt: "لخّص حالة التذاكر في المشروع مع أولوية الأعلى خطورة."
        }
      ].filter(Boolean) as Suggestion[]
    : [
        {
          title: "تخفيف المحددات",
          prompt: "جرب إزالة المحددات أو زيادة الحد الأقصى للنتائج لرؤية تذاكر أخرى.",
          data: {
            limit,
            statuses: validStatuses
          }
        }
      ]

  return {
    status: 200,
    body: {
      success: true,
      projectId,
      meta: {
        unitCode: unitCode ?? null,
        statuses: validStatuses,
        count: tickets.length
      },
      data: {
        tickets
      },
      message: tickets.length === 0 ? "لا توجد تذاكر بالمحددات الحالية" : undefined,
      humanReadable,
      suggestions
    }
  }
}

async function handleProjectUnitsList(
  manager: ManagerRecord,
  payload: ActionMap["LIST_PROJECT_UNITS"]
): Promise<HandlerResponse> {
  const { projectId, includeInactive, limit, search } = payload

  if (!projectId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "projectId is required",
        projectId: null,
        humanReadable: {
          ar: "أحتاج رقم المشروع حتى أستعرض وحداته."
        },
        suggestions: [
          {
            title: "تحديد المشروع",
            prompt: "اذكر رقم المشروع ثم اطلب عرض الوحدات."
          }
        ]
      }
    }
  }

  if (!assertProjectAccess(manager, projectId)) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Project manager is not assigned to this project",
        projectId,
        humanReadable: {
          ar: "أنت غير مكلّف بهذا المشروع لذلك لا يمكنني عرض وحداته."
        },
        suggestions: [
          {
            title: "طلب إضافة المشروع",
            prompt: "اطلب إضافة المشروع لصلاحياتي ثم أعد طلب قائمة الوحدات.",
            data: {
              managerId: manager.id,
              projectId
            }
          }
        ]
      }
    }
  }

  const take = parseLimit(limit, 15, 50)
  const normalizedSearch = typeof search === "string" && search.trim().length > 0 ? search.trim() : null

  const units = await db.operationalUnit.findMany({
    where: {
      projectId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(normalizedSearch
        ? {
            OR: [
              {
                code: {
                  contains: normalizedSearch
                }
              },
              {
                name: {
                  contains: normalizedSearch
                }
              }
            ]
          }
        : {})
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      isActive: true,
      monthlyBillingDay: true,
      monthlyManagementFee: true,
      _count: {
        select: {
          residents: true,
          tickets: true
        }
      }
    },
    orderBy: { code: "asc" },
    take
  })

  const firstUnit = units[0]
  const activeUnits = units.filter((unit) => unit.isActive).length
  const searchLabel = normalizedSearch ? ` matching "${normalizedSearch}"` : ""

  const humanReadable: HumanReadable = units.length
    ? {
        ar: `تم العثور على ${units.length} وحدة${includeInactive ? " (بما فيها المتوقفة)" : ""}${normalizedSearch ? ` مطابقة لـ "${normalizedSearch}"` : ""}. ${activeUnits} نشطة.`
      }
    : {
        ar: normalizedSearch
          ? `لا توجد وحدات مطابقة لـ "${normalizedSearch}" في هذا المشروع.`
          : "لم يتم العثور على وحدات لهذا المشروع."
      }

  const suggestions: Suggestion[] = units.length
    ? [
        firstUnit
          ? {
              title: `استعلام سكان ${firstUnit.code}`,
              prompt: `هات سكان الوحدة ${firstUnit.code} في المشروع ${projectId}.`,
              data: {
                projectId,
                unitCode: firstUnit.code
              }
            }
          : undefined,
        includeInactive
          ? undefined
          : {
              title: "عرض الوحدات المتوقفة",
              prompt: `هات وحدات المشروع ${projectId} بما فيها المتوقفة.`,
              data: {
                projectId,
                includeInactive: true
              }
            },
        normalizedSearch
          ? undefined
          : {
              title: "بحث باسم او كود",
              prompt: "دور على وحدة حسب الكود أو الاسم داخل نفس المشروع.",
              data: {
                projectId
              }
            }
      ].filter(Boolean) as Suggestion[]
    : [
        {
          title: "تحقق من المشروع",
          prompt: "تأكد من أن المشروع يحتوي على وحدات أو جرّب مشروعاً آخر.",
          data: {
            projectId
          }
        }
      ]

  return {
    status: 200,
    body: {
      success: true,
      projectId,
      meta: {
        includeInactive: !!includeInactive,
        count: units.length,
        search: normalizedSearch
      },
      data: {
        units
      },
      humanReadable,
      suggestions
    }
  }
}

async function handleUnitExpensesList(
  manager: ManagerRecord,
  payload: ActionMap["LIST_UNIT_EXPENSES"]
): Promise<HandlerResponse> {
  const {
    projectId: rawProjectId,
    projectName,
    unitCode,
    limit,
    sourceTypes,
    search,
    fromDate,
    toDate,
    filterDsl
  } = payload

  const normalizedProjectName =
    typeof projectName === "string" && projectName.trim().length > 0
      ? projectName.trim()
      : null

  let projectRecord: { id: string; name: string | null } | null = null

  const cleanedProjectId =
    typeof rawProjectId === "string" && rawProjectId.trim().length > 0
      ? rawProjectId.trim()
      : null

  if (cleanedProjectId) {
    projectRecord = await db.project.findUnique({
      where: { id: cleanedProjectId },
      select: {
        id: true,
        name: true
      }
    })

    if (!projectRecord) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Project not found",
          projectId: cleanedProjectId,
          humanReadable: {
            ar: "لم أجد هذا المشروع لذلك لا يمكنني عرض مصروفاته."
          }
        }
      }
    }

    if (
      normalizedProjectName &&
      projectRecord.name &&
      projectRecord.name.toLowerCase().trim() !== normalizedProjectName.toLowerCase()
    ) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Project identifier mismatch",
          projectId: projectRecord.id,
          humanReadable: {
            ar: "الاسم والرقم المشار إليهما يعودان لمشروعين مختلفين."
          },
          issues: {
            projectId: projectRecord.id,
            projectName: normalizedProjectName,
            matchedProjectName: projectRecord.name
          }
        }
      }
    }
  }

  if (!projectRecord && normalizedProjectName) {
    if (manager.canViewAllProjects) {
      const candidates = await db.project.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: "asc"
        }
      })

      const lowerSearch = normalizedProjectName.toLowerCase()

      const matchedCandidates = candidates.filter((candidate) =>
        candidate.name ? candidate.name.toLowerCase().includes(lowerSearch) : false
      )

      const exactMatch = matchedCandidates.find((candidate) =>
        candidate.name
          ? candidate.name.toLowerCase().trim() === lowerSearch
          : false
      )

      if (exactMatch) {
        projectRecord = exactMatch
      } else if (matchedCandidates.length === 1) {
        projectRecord = matchedCandidates[0]
      }

      if (!projectRecord) {
        return {
          status: matchedCandidates.length > 1 ? 409 : 404,
          body: {
            success: false,
            error: matchedCandidates.length > 1 ? "Project name ambiguous" : "Project not found",
            projectId: null,
            humanReadable: {
              ar:
                matchedCandidates.length > 1
                  ? "اسم المشروع مطابق لأكثر من مشروع. حدد الاسم الكامل من القائمة."
                  : "لم أجد مشروعًا بهذا الاسم لذلك لا توجد مصروفات أعرضها."
            },
            issues: {
              projectName: normalizedProjectName,
              matchedProjectNames: matchedCandidates.map((candidate) => candidate.name)
            },
            suggestions:
              matchedCandidates.length > 0
                ? [
                    {
                      title: "اختيار اسم المشروع",
                      prompt: "اذكر اسم المشروع بالضبط كما هو مسجل.",
                      data: {
                        options: matchedCandidates.map((candidate) => ({
                          projectId: candidate.id,
                          projectName: candidate.name
                        }))
                      }
                    }
                  ]
                : undefined
          }
        }
      }
    } else {
      const matchedAssignment = manager.assignedProjects.find((assignment) => {
        const assignmentName = assignment.project?.name
        return assignmentName
          ? assignmentName.toLowerCase().trim() === normalizedProjectName.toLowerCase()
          : false
      })

      if (!matchedAssignment) {
        return {
          status: 403,
          body: {
            success: false,
            error: "Project manager is not assigned to this project",
            projectId: null,
            humanReadable: {
              ar: "المدير غير مكلّف بهذا المشروع بالاسم المذكور."
            },
            suggestions: [
              {
                title: "طلب إضافة المشروع",
                prompt: "اطلب إضافة المشروع لصلاحياتي ثم أعد الطلب باسم المشروع أو رقمه.",
                data: {
                  managerId: manager.id,
                  projectName: normalizedProjectName
                }
              }
            ]
          }
        }
      }

      projectRecord = {
        id: matchedAssignment.projectId,
        name: matchedAssignment.project?.name ?? null
      }
    }
  }

  if (!projectRecord) {
    return {
      status: 400,
      body: {
        success: false,
        error: "projectId is required",
        projectId: null,
        humanReadable: {
          ar: "أحتاج رقم المشروع أو اسمه حتى أستعرض المصروفات."
        },
        suggestions: [
          {
            title: "تحديد المشروع",
            prompt: "اذكر رقم المشروع أو اسمه ثم اطلب عرض مصروفات الوحدة."
          }
        ]
      }
    }
  }

  const projectId = projectRecord.id

  if (!assertProjectAccess(manager, projectId)) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Project manager is not assigned to this project",
        projectId,
        humanReadable: {
          ar: "أنت غير مكلّف بهذا المشروع لذلك لا يمكنني عرض مصروفاته."
        },
        suggestions: [
          {
            title: "طلب إضافة المشروع",
            prompt: "اطلب إضافة المشروع لصلاحياتي ثم أعد طلب مصروفات الوحدة.",
            data: {
              managerId: manager.id,
              projectId
            }
          }
        ]
      }
    }
  }

  let unit: { id: string; code: string | null } | null = null

  if (unitCode) {
    unit = await db.operationalUnit.findFirst({
      where: {
        projectId,
        code: unitCode
      },
      select: {
        id: true,
        code: true
      }
    })

    if (!unit) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Operational unit not found",
          projectId,
          issues: { unitCode },
          humanReadable: {
            ar: "لم أجد هذه الوحدة داخل المشروع، لذلك لا توجد مصروفات أعرضها."
          },
          suggestions: [
            {
              title: "عرض أكواد الوحدات",
              prompt: "هات أكواد الوحدات المتاحة في هذا المشروع.",
              data: {
                projectId
              }
            }
          ]
        }
      }
    }
  }

  const explicitSourceTypes: ExpenseSourceType[] = Array.isArray(sourceTypes)
    ? sourceTypes.filter((type: string): type is ExpenseSourceType =>
        EXPENSE_SOURCE_TYPES.includes(type as ExpenseSourceType)
      )
    : []
  const explicitSourceTypeSet = new Set(explicitSourceTypes)

  const rawSearchTerm =
    typeof search === "string" && search.trim().length > 0 ? search.trim() : null
  let cleanedSearchTerm: string | null = null
  let matchedSourceTypes = new Set<ExpenseSourceType>()
  let descriptionTokensForFilter: string[] = []

  if (rawSearchTerm) {
    const analysis = analyzeExpenseSearch(rawSearchTerm)
    matchedSourceTypes = analysis.matchedSourceTypes
    descriptionTokensForFilter = analysis.descriptionTokens
    cleanedSearchTerm = analysis.descriptionSummary
  }

  let finalTypeSet: Set<ExpenseSourceType> | null =
    explicitSourceTypeSet.size > 0 ? new Set(explicitSourceTypeSet) : null

  const hasDescriptionFilters = descriptionTokensForFilter.length > 0

  if (matchedSourceTypes.size > 0) {
    if (finalTypeSet) {
      finalTypeSet = new Set(
        [...finalTypeSet].filter((type) => matchedSourceTypes.has(type))
      )
    } else if (!hasDescriptionFilters) {
      finalTypeSet = new Set(matchedSourceTypes)
    }
  }

  const normalizedFilterDsl = typeof filterDsl === "string" ? filterDsl.trim() : ""
  const filterDslResult = normalizedFilterDsl
    ? parseExpenseFilterDsl(normalizedFilterDsl)
    : { errors: [] as string[], where: undefined }

  if (filterDslResult.errors.length > 0) {
    const currentProjectId = projectRecord?.id ?? null
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid filterDsl expression",
        projectId: currentProjectId,
        humanReadable: {
          ar: "صيغة فلتر المصروفات غير صحيحة. راجع الصياغة وحاول مرة أخرى."
        },
        issues: {
          filterDsl,
          errors: filterDslResult.errors
        }
      }
    }
  }

  let fromDateValue: Date | null = null
  let toDateValue: Date | null = null

  try {
    fromDateValue = parseDateInput(fromDate, "fromDate")
    toDateValue = parseDateInput(toDate, "toDate")
  } catch (error) {
    return {
      status: 400,
      body: {
        success: false,
        error: (error as Error).message,
        projectId,
        humanReadable: {
          ar: "تصفية التاريخ غير صحيحة. استخدم صيغة YYYY-MM-DD."
        }
      }
    }
  }

  if (fromDateValue && toDateValue && fromDateValue > toDateValue) {
    return {
      status: 400,
      body: {
        success: false,
        error: "fromDate must be before toDate",
        projectId,
        issues: { fromDate, toDate },
        humanReadable: {
          ar: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية."
        }
      }
    }
  }

  const take = parseLimit(limit, 10, 50)

  if (fromDateValue) {
    fromDateValue.setHours(0, 0, 0, 0)
  }
  if (toDateValue) {
    toDateValue.setHours(23, 59, 59, 999)
  }

  const dateFilters: Prisma.DateTimeFilter = {}
  if (fromDateValue) {
    dateFilters.gte = fromDateValue
  }
  if (toDateValue) {
    dateFilters.lte = toDateValue
  }

  const descriptionFilter =
    descriptionTokensForFilter.length > 0
      ? buildDescriptionFilter(descriptionTokensForFilter)
      : null

  const shouldSkipQuery = finalTypeSet !== null && finalTypeSet.size === 0
  const appliedSourceTypesForFilter =
    finalTypeSet && finalTypeSet.size > 0 ? Array.from(finalTypeSet) : []

  const baseWhereClauses: Prisma.UnitExpenseWhereInput[] = [
    {
      unit: {
        projectId,
        ...(unit ? { id: unit.id } : {})
      }
    }
  ]

  if (appliedSourceTypesForFilter.length > 0) {
    baseWhereClauses.push({
      sourceType: { in: appliedSourceTypesForFilter }
    })
  }

  if (descriptionFilter) {
    baseWhereClauses.push(descriptionFilter)
  }

  if (filterDslResult.where) {
    baseWhereClauses.push(filterDslResult.where)
  }

  const currentWhereClauses = [...baseWhereClauses]

  if (Object.keys(dateFilters).length > 0) {
    currentWhereClauses.push({ date: dateFilters })
  }

  const whereClause: Prisma.UnitExpenseWhereInput =
    currentWhereClauses.length === 1 ? currentWhereClauses[0] : { AND: currentWhereClauses }

  const expenses = shouldSkipQuery
    ? []
    : (await db.unitExpense.findMany({
        where: whereClause,
        include: {
          unit: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          recordedByUser: {
            select: {
              id: true,
              name: true
            }
          },
          pmAdvance: {
            select: {
              id: true,
              amount: true,
              remainingAmount: true
            }
          }
        },
        orderBy: { date: "desc" },
        take
      })) as UnitExpenseWithRelations[]

  const totalAmount = expenses.reduce(
    (sum, expense) => sum + toNumericAmount(expense.amount ?? 0),
    0
  )
  const sourceBreakdown = expenses.reduce((acc, expense) => {
    const key = expense.sourceType as ExpenseSourceType
    acc[key] = acc[key] ?? { count: 0, amount: 0 }
    acc[key].count += 1
    acc[key].amount += toNumericAmount(expense.amount ?? 0)
    return acc
  }, {} as Record<ExpenseSourceType, { count: number; amount: number }>)
  const averageExpense = expenses.length > 0 ? Number((totalAmount / expenses.length).toFixed(2)) : 0

  let topCategory: {
    type: ExpenseSourceType
    count: number
    total: number
  } | null = null

  for (const [typeKey, breakdown] of Object.entries(sourceBreakdown) as Array<[
    ExpenseSourceType,
    { count: number; amount: number }
  ]>) {
    if (!topCategory || breakdown.amount > topCategory.total) {
      topCategory = {
        type: typeKey,
        count: breakdown.count,
        total: Number(breakdown.amount.toFixed(2))
      }
    }
  }

  type TrendDirection = "UP" | "DOWN" | "SAME" | "NO_DATA"

  let trendInfo: {
    direction: TrendDirection
    currentTotal: number
    previousTotal: number
    percentageChange: number | null
    previousRange: {
      from: string | null
      to: string | null
    }
    reason?: "MISSING_RANGE" | "NO_BASELINE"
  } | null = null

  if (!shouldSkipQuery && fromDateValue && toDateValue) {
    const periodMs = Math.max(toDateValue.getTime() - fromDateValue.getTime(), 0)
    const previousPeriodEnd = new Date(fromDateValue.getTime() - 1)
    previousPeriodEnd.setHours(23, 59, 59, 999)
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodMs)
    previousPeriodStart.setHours(0, 0, 0, 0)

    const previousDateFilter: Prisma.DateTimeFilter = {
      gte: previousPeriodStart,
      lte: previousPeriodEnd
    }

    const previousWhereClauses = [...baseWhereClauses, { date: previousDateFilter }]
    const previousWhere: Prisma.UnitExpenseWhereInput =
      previousWhereClauses.length === 1
        ? previousWhereClauses[0]
        : { AND: previousWhereClauses }

    const previousAggregate = await db.unitExpense.aggregate({
      where: previousWhere,
      _sum: { amount: true }
    })

    const previousTotal = toNumericAmount(previousAggregate._sum.amount ?? 0)

    let direction: TrendDirection = "NO_DATA"
    let percentageChange: number | null = null
    let reason: "NO_BASELINE" | undefined

    if (previousTotal === 0 && totalAmount === 0) {
      direction = "SAME"
      percentageChange = 0
    } else if (previousTotal === 0 && totalAmount > 0) {
      direction = "UP"
      reason = "NO_BASELINE"
    } else if (previousTotal > 0 && totalAmount === 0) {
      direction = "DOWN"
      percentageChange = 100
    } else if (previousTotal > 0) {
      const delta = totalAmount - previousTotal
      if (Math.abs(delta) < 0.01) {
        direction = "SAME"
        percentageChange = 0
      } else if (delta > 0) {
        direction = "UP"
        percentageChange = Number(((delta / previousTotal) * 100).toFixed(1))
      } else {
        direction = "DOWN"
        percentageChange = Number(((Math.abs(delta) / previousTotal) * 100).toFixed(1))
      }
    }

    trendInfo = {
      direction,
      currentTotal: Number(totalAmount.toFixed(2)),
      previousTotal: Number(previousTotal.toFixed(2)),
      percentageChange,
      previousRange: {
        from: formatDate(previousPeriodStart),
        to: formatDate(previousPeriodEnd)
      },
      reason
    }
  } else if (!shouldSkipQuery && (fromDateValue || toDateValue)) {
    trendInfo = {
      direction: "NO_DATA",
      currentTotal: Number(totalAmount.toFixed(2)),
      previousTotal: 0,
      percentageChange: null,
      previousRange: {
        from: null,
        to: null
      },
      reason: "MISSING_RANGE"
    }
  }
  const latestExpense = expenses[0]
  const unitCodes = Array.from(
    new Set(
      expenses
        .map((expense) => expense.unit?.code)
        .filter((code): code is string => typeof code === "string" && code.length > 0)
    )
  )
  const unitLabel = unit
    ? unit.code ?? "الوحدة"
    : unitCodes.length
      ? `${unitCodes.length} وحدات`
      : "المشروع"
  const latestDateLabel = latestExpense ? formatDate(latestExpense.date) : null
  const detailLines = buildExpenseLines(expenses)
  const remainingCount = Math.max(expenses.length - detailLines.length, 0)

  const topExpenses = expenses.slice(0, 5)
  const reportLines: string[] = []
  reportLines.push("📊 تقرير المصروفات")
  reportLines.push(`• الإجمالي: ${formatCurrency(totalAmount)} جنيه`)
  reportLines.push(`• عدد العمليات: ${expenses.length}`)
  if (appliedSourceTypesForFilter.length > 0 || matchedSourceTypes.size > 0) {
    const appliedTypes = appliedSourceTypesForFilter.length
      ? appliedSourceTypesForFilter
      : Array.from(matchedSourceTypes)
    if (appliedTypes.length > 0) {
      reportLines.push(
        `• أنواع المصادر: ${appliedTypes
          .map((type) => formatSourceTypeLabel(type))
          .join("، ")}`
      )
    }
  }
  if (fromDateValue || toDateValue) {
    reportLines.push(
      `• الفترة: ${formatDate(fromDateValue) ?? "—"} → ${formatDate(toDateValue) ?? "—"}`
    )
  }
  if (unit) {
    reportLines.push(`• الوحدة: ${unit.code ?? "—"}`)
  } else {
    reportLines.push("• وحدة محددة: غير محدد")
  }
  if (expenses.length > 0) {
    reportLines.push(`• متوسط العملية: ${formatCurrency(averageExpense)} جنيه`)
  }
  if (topCategory) {
    reportLines.push(
      `• أعلى فئة: ${formatSourceTypeLabel(topCategory.type)} — ${formatCurrency(topCategory.total)} جنيه (${topCategory.count} عملية)`
    )
  }
  if (trendInfo) {
    let trendLine: string
    const changeLabel =
      trendInfo.percentageChange !== null
        ? ` (${trendInfo.percentageChange.toFixed(1)}%)`
        : trendInfo.reason === "NO_BASELINE"
          ? " (لا توجد فترة مقارنة سابقة)"
          : ""

    switch (trendInfo.direction) {
      case "UP":
        trendLine = `• الاتجاه: المصروفات أعلى من الفترة السابقة${changeLabel}.`
        break
      case "DOWN":
        trendLine = `• الاتجاه: المصروفات أقل من الفترة السابقة${changeLabel}.`
        break
      case "SAME":
        trendLine = "• الاتجاه: المصروفات في نفس مستوى الفترة السابقة."
        break
      default:
        trendLine =
          trendInfo.reason === "MISSING_RANGE"
            ? "• الاتجاه: لا يمكن المقارنة لعدم تحديد فترة كاملة."
            : "• الاتجاه: لا توجد بيانات كافية للمقارنة."
        break
    }

    reportLines.push(trendLine)
  }
  reportLines.push("-------------------")

  if (topExpenses.length === 0) {
    reportLines.push("- لا توجد مصروفات مطابقة")
  } else {
    for (const expense of topExpenses) {
      const expenseUnitLabel = expense.unit?.code ?? expense.unit?.name ?? "—"
      const description = expense.description?.trim() || "(بدون وصف)"
      const amountLabel = formatCurrency(toNumericAmount(expense.amount ?? 0))
      const dateLabel = formatDate(expense.date) ?? "—"
      reportLines.push(`- ${dateLabel} • ${expenseUnitLabel}: ${amountLabel} جنيه — ${description}`)
    }
    if (expenses.length > topExpenses.length) {
      reportLines.push(`- (+${expenses.length - topExpenses.length} مصروف إضافي) ...`)
    }
  }

  const structuredReport = {
    summary: reportLines.join("\n"),
    totalAmount,
    rawCount: expenses.length,
    averageExpense,
    topCategory: topCategory
      ? {
          sourceType: topCategory.type,
          label: formatSourceTypeLabel(topCategory.type),
          amount: topCategory.total,
          count: topCategory.count
        }
      : null,
    trend: trendInfo
      ? {
          direction: trendInfo.direction,
          currentTotal: trendInfo.currentTotal,
          previousTotal: trendInfo.previousTotal,
          percentageChange: trendInfo.percentageChange,
          previousRange: trendInfo.previousRange,
          reason: trendInfo.reason ?? null
        }
      : null,
    topExpenses: topExpenses.map((expense) => ({
      id: expense.id,
      unitCode: expense.unit?.code ?? null,
      unitName: expense.unit?.name ?? null,
      description: expense.description,
      amount: toNumericAmount(expense.amount ?? 0),
      date: expense.date,
      sourceType: expense.sourceType
    })),
    filters: {
      projectId,
      projectName: projectRecord.name ?? null,
      unitCode: unit?.code ?? null,
      search: rawSearchTerm,
      fromDate: fromDateValue ? formatDate(fromDateValue) : null,
      toDate: toDateValue ? formatDate(toDateValue) : null,
      sourceTypes: appliedSourceTypesForFilter
    }
  }

  const humanReadable: HumanReadable = expenses.length
    ? {
        ar: `تم العثور على ${expenses.length} مصروف${expenses.length === 1 ? "" : "ات"} لـ ${unit ? `الوحدة ${unitLabel}` : "المشروع"} بإجمالي ${formatCurrency(totalAmount)}${rawSearchTerm ? ` مطابقة لـ "${rawSearchTerm}"` : ""}${fromDateValue || toDateValue ? buildDateRangeLabel(fromDateValue, toDateValue) : ""}.${latestDateLabel ? ` آخر مصروف بتاريخ ${latestDateLabel}.` : ""}${detailLines.length ? `\n${detailLines.join("\n")}` : ""}${remainingCount > 0 ? `\n• (+${remainingCount} مصروف إضافي)` : ""}`
      }
    : {
        ar: unit
          ? rawSearchTerm
            ? `لا توجد مصروفات مطابقة لـ "${rawSearchTerm}" للوحدة ${unitLabel}.`
            : `لا توجد مصروفات مسجلة حتى الآن للوحدة ${unitLabel}.`
          : rawSearchTerm
            ? `لا توجد مصروفات مطابقة لـ "${rawSearchTerm}" لهذا المشروع.`
            : fromDateValue || toDateValue
              ? "لا توجد مصروفات في نطاق التاريخ المحدد."
                    : "لا توجد مصروفات مسجلة لهذا المشروع."
      }

  const suggestions: Suggestion[] = expenses.length
    ? [
        latestExpense
          ? {
              title: "تفاصيل آخر مصروف",
              prompt: `هات تفاصيل المصروف ${latestExpense.id}.`,
              data: {
                expenseId: latestExpense.id,
                projectId,
                unitCode: unit ? unit.code : latestExpense.unit?.code
              }
            }
          : undefined,
        unit
          ? undefined
          : {
              title: "تصفية لوحدة محددة",
              prompt: "هات مصروفات الوحدة بكود معين داخل نفس المشروع.",
              data: {
                projectId
              }
            },
        rawSearchTerm
          ? undefined
          : {
              title: "بحث في الوصف",
              prompt: "دور على مصروفات تحتوي كلمة معينة في الوصف داخل المشروع.",
              data: {
                projectId,
                unitCode
              }
            },
        fromDateValue || toDateValue
          ? {
              title: "تعديل نطاق التاريخ",
              prompt: "غير فترة التاريخ وابحث مرة أخرى عن المصروفات.",
              data: {
                projectId,
                unitCode
              }
            }
          : undefined
      ].filter(Boolean) as Suggestion[]
    : [
        {
          title: "تسجيل مصروف جديد",
          prompt: "سجل مصروف تشغيلي جديد للوحدة مع التفاصيل المطلوبة.",
          data: {
            projectId,
            unitCode
          }
        },
        fromDateValue || toDateValue
          ? {
              title: "تعديل نطاق التاريخ",
              prompt: "غير فترة التاريخ وابحث مرة أخرى عن المصروفات.",
              data: {
                projectId,
                unitCode
              }
            }
          : undefined
      ].filter(Boolean) as Suggestion[]

  return {
    status: 200,
    body: {
      success: true,
      projectId,
      meta: {
        projectName: projectRecord.name ?? null,
        unitCode: unit?.code ?? null,
        count: expenses.length,
        totalAmount,
        filteredSourceTypes: appliedSourceTypesForFilter,
        requestedSourceTypes: explicitSourceTypes,
        detectedSourceTypesFromSearch: Array.from(matchedSourceTypes),
        search: rawSearchTerm,
        descriptionSearchTerm: cleanedSearchTerm,
        skippedQueryBecauseOfFilters: shouldSkipQuery,
        fromDate: fromDateValue ? formatDate(fromDateValue) : null,
        toDate: toDateValue ? formatDate(toDateValue) : null,
        breakdownBySourceType: Object.fromEntries(
          Object.entries(sourceBreakdown).map(([key, value]) => [
            key,
            {
              count: value.count,
              amount: Number(value.amount.toFixed(2)),
              label: formatSourceTypeLabel(key as ExpenseSourceType)
            }
          ])
        ),
        averageExpense,
        topCategory: topCategory
          ? {
              sourceType: topCategory.type,
              label: formatSourceTypeLabel(topCategory.type),
              count: topCategory.count,
              amount: topCategory.total
            }
          : null,
        trend: trendInfo
          ? {
              direction: trendInfo.direction,
              currentTotal: trendInfo.currentTotal,
              previousTotal: trendInfo.previousTotal,
              percentageChange: trendInfo.percentageChange,
              previousRange: trendInfo.previousRange,
              reason: trendInfo.reason ?? null
            }
          : null,
        reportSummary: structuredReport.summary
      },
      data: {
        expenses,
        report: structuredReport
      },
      humanReadable,
      suggestions
    }
  }
}

async function handleLastElectricityTopup(
  manager: ManagerRecord,
  payload: ActionMap["GET_LAST_ELECTRICITY_TOPUP"]
): Promise<HandlerResponse> {
  const { projectId, unitCode } = payload

  if (!projectId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "projectId is required",
        projectId: null,
        humanReadable: {
          ar: "أحتاج رقم المشروع حتى أتحقق من آخر شحن كهرباء."
        },
        suggestions: [
          {
            title: "تحديد المشروع",
            prompt: "اذكر رقم المشروع ثم اسأل عن شحن الكهرباء."
          }
        ]
      }
    }
  }

  if (!assertProjectAccess(manager, projectId)) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Project manager is not assigned to this project",
        projectId,
        humanReadable: {
          ar: "أنت غير مكلّف بهذا المشروع لذلك لا يمكنني عرض شحنات الكهرباء الخاصة به."
        },
        suggestions: [
          {
            title: "طلب إضافة المشروع",
            prompt: "اطلب إضافة المشروع لصلاحياتي ثم أعد طلب شحن الكهرباء.",
            data: {
              managerId: manager.id,
              projectId
            }
          }
        ]
      }
    }
  }

  let unit: { id: string; code: string | null } | null = null

  if (unitCode) {
    unit = await db.operationalUnit.findFirst({
      where: {
        projectId,
        code: unitCode
      },
      select: {
        id: true,
        code: true
      }
    })

    if (!unit) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Operational unit not found",
          projectId,
          issues: { unitCode },
          humanReadable: {
            ar: "لم أجد هذه الوحدة داخل المشروع، لذلك لا أستطيع التحقق من شحن كهربائها."
          },
          suggestions: [
            {
              title: "عرض الوحدات",
              prompt: "هات الوحدات المتاحة في هذا المشروع.",
              data: {
                projectId
              }
            }
          ]
        }
      }
    }
  }

  const topup = (await db.unitExpense.findFirst({
    where: {
      sourceType: "ELECTRICITY",
      unit: {
        projectId,
        ...(unit ? { id: unit.id } : {})
      }
    },
    include: {
      unit: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      recordedByUser: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { date: "desc" }
  })) as UnitExpenseWithRelations | null

  const humanReadable: HumanReadable = topup
    ? {
        ar: `آخر شحن كهرباء كان بقيمة ${formatCurrency(topup.amount)} بتاريخ ${formatDate(topup.date)} للوحدة ${topup.unit?.code ?? "غير معروف"}.`
      }
    : {
        ar: unit
          ? `لا توجد شحنات كهرباء مسجلة للوحدة ${unit.code}.`
          : "لا توجد شحنات كهرباء مسجلة لهذا المشروع."
      }

  const suggestions: Suggestion[] = topup
    ? [
        {
          title: "عرض آخر 5 شحنات",
          prompt: "هات آخر خمس شحنات كهرباء للمشروع نفسه.",
          data: {
            projectId,
            limit: 5
          }
        },
        {
          title: "إجمالي مصاريف الكهرباء",
          prompt: "حاسبني إجمالي مصاريف الكهرباء للمشروع ده.",
          data: {
            projectId
          }
        }
      ]
    : [
        {
          title: "تسجيل شحن كهرباء",
          prompt: "سجل شحن كهرباء جديد للمشروع وحدد القيمة والتاريخ.",
          data: {
            projectId,
            unitCode
          }
        }
      ]

  return {
    status: 200,
    body: {
      success: true,
      projectId,
      meta: {
        unitCode: unit?.code ?? topup?.unit?.code ?? null
      },
      data: {
        topup
      },
      humanReadable,
      suggestions
    }
  }
}

const actionHandlers: Record<AllowedAction, GenericActionHandler> = {
  CREATE_OPERATIONAL_EXPENSE: handleCreateOperationalExpense as GenericActionHandler,
  GET_RESIDENT_PHONE: handleResidentLookup as GenericActionHandler,
  LIST_PROJECT_TICKETS: handleTicketSummary as GenericActionHandler,
  LIST_PROJECT_UNITS: handleProjectUnitsList as GenericActionHandler,
  LIST_UNIT_EXPENSES: handleUnitExpensesList as GenericActionHandler,
  GET_LAST_ELECTRICITY_TOPUP: handleLastElectricityTopup as GenericActionHandler
}

const EVENT_TYPES: Record<
  AllowedAction,
  | "PM_OPERATIONAL_EXPENSE_CREATED"
  | "PM_RESIDENT_LOOKUP"
  | "PM_TICKETS_SUMMARY"
  | "PM_PROJECT_UNITS_LISTED"
  | "PM_UNIT_EXPENSES_LISTED"
  | "PM_ELECTRICITY_TOPUP_LOOKUP"
> = {
  CREATE_OPERATIONAL_EXPENSE: "PM_OPERATIONAL_EXPENSE_CREATED",
  GET_RESIDENT_PHONE: "PM_RESIDENT_LOOKUP",
  LIST_PROJECT_TICKETS: "PM_TICKETS_SUMMARY",
  LIST_PROJECT_UNITS: "PM_PROJECT_UNITS_LISTED",
  LIST_UNIT_EXPENSES: "PM_UNIT_EXPENSES_LISTED",
  GET_LAST_ELECTRICITY_TOPUP: "PM_ELECTRICITY_TOPUP_LOOKUP"
}

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"
  let requestBody: RequestBody | null = null

  try {
    requestBody = await req.json()
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const auth = await verifyN8nApiKey(req)
  if (!auth.valid || !auth.context) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }

  if (auth.context.role !== "PROJECT_MANAGER" && auth.context.role !== "ADMIN") {
    await logWebhookEvent(
      auth.context.keyId,
      "PM_TICKETS_SUMMARY",
      ENDPOINT,
      "POST",
      403,
      requestBody,
      { error: "API key not permitted for project manager actions" },
      "API key not permitted for project manager actions",
      ipAddress
    )

    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const action = requestBody?.action
  const senderPhone = String(requestBody?.senderPhone ?? "").trim()
  const payload = requestBody?.payload ?? {}

  if (!action || !ALLOWED_ACTIONS.includes(action as AllowedAction)) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  }

  if (!senderPhone) {
    return NextResponse.json({ error: "senderPhone is required" }, { status: 400 })
  }

  const manager = await resolveProjectManager(senderPhone)

  if (!manager) {
    await logWebhookEvent(
      auth.context.keyId,
      EVENT_TYPES[action as AllowedAction],
      ENDPOINT,
      "POST",
      404,
      requestBody,
      { error: "Project manager not found for sender phone" },
      "Project manager not found for phone",
      ipAddress
    )

    return NextResponse.json(
      { error: "Project manager not found for sender phone" },
      { status: 404 }
    )
  }

  const handler = actionHandlers[action as AllowedAction]
  const actionPayload = payload as ActionMap[AllowedAction]

  let response

  const managerContext = buildManagerContext(manager)

  try {
    response = await handler(manager, actionPayload)
  } catch (error) {
    console.error("Project manager webhook error:", error)
    response = {
      status: 500,
      body: { success: false, error: "Internal server error" }
    }
  }

  const projectIdFromPayload =
    (actionPayload as { projectId?: string | null })?.projectId ??
    (response.body as ActionSuccessPayload | ActionErrorPayload).projectId ??
    null

  const enrichedBody = response.body.success
    ? {
        success: true,
        action,
        manager: managerContext,
        projectId: projectIdFromPayload,
        meta: {
          managerName: manager.name,
          ...(response.body as ActionSuccessPayload).meta
        },
        data: (response.body as ActionSuccessPayload).data,
        message: (response.body as ActionSuccessPayload).message,
        humanReadable: (response.body as ActionSuccessPayload).humanReadable,
        suggestions: (response.body as ActionSuccessPayload).suggestions
      }
    : {
        success: false,
        action,
        manager: managerContext,
        projectId: projectIdFromPayload,
        error: (response.body as ActionErrorPayload).error,
        issues: (response.body as ActionErrorPayload).issues,
        meta: {
          managerName: manager.name,
          ...(response.body as ActionErrorPayload).meta
        },
        humanReadable: (response.body as ActionErrorPayload).humanReadable,
        suggestions: (response.body as ActionErrorPayload).suggestions
      }

  await logWebhookEvent(
    auth.context.keyId,
    EVENT_TYPES[action as AllowedAction],
    ENDPOINT,
    "POST",
    response.status,
    requestBody,
    enrichedBody,
    response.status >= 400 ? (enrichedBody as any)?.error : undefined,
    ipAddress
  )

  return NextResponse.json(enrichedBody, { status: response.status })
}
