import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import {
  analyzeExpenseSearch,
  buildDescriptionFilter,
  EXPENSE_SOURCE_TYPES,
  parseExpenseFilterDsl,
  parseInvoiceFilterDsl,
  parseStaffAdvanceFilterDsl,
  parseAccountingNoteFilterDsl,
  parsePayrollFilterDsl,
  type ExpenseSourceType
} from "@/lib/expense-search"
import {
  convertAccountingNote,
  AccountingNoteAlreadyProcessedError,
  AccountingNoteMissingUnitError,
  AccountingNoteNotFoundError,
  AccountingNotePmAdvanceInsufficientError,
  AccountingNotePmAdvanceNotFoundError,
  AccountingNotePmAdvanceRequiredError,
  type AccountingNoteWithRelations
} from "@/lib/accounting-note-conversion"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"
import {
  resolveStaffReference,
  searchStaffByName,
  buildStaffAdvancesSummary,
  type StaffSearchMatch,
  type StaffResolution
} from "@/lib/staff-search"

const ENDPOINT = "/api/webhooks/accountants"

const ALLOWED_ACTIONS = [
  "CREATE_PM_ADVANCE",
  "CREATE_STAFF_ADVANCE",
  "UPDATE_STAFF_ADVANCE",
  "DELETE_STAFF_ADVANCE",
  "RECORD_ACCOUNTING_NOTE",
  "PAY_INVOICE",
  "CREATE_PAYROLL",
  "PAY_PAYROLL",
  "LIST_PAYROLLS",
  "LIST_UNIT_EXPENSES",
  "LIST_INVOICES",
  "GET_INVOICE_DETAILS",
  "SEARCH_STAFF",
  "LIST_STAFF_ADVANCES",
  "SEARCH_ACCOUNTING_NOTES"
] as const

type AllowedAction = (typeof ALLOWED_ACTIONS)[number]

const EXPENSE_SOURCE_LABELS: Record<ExpenseSourceType, string> = {
  TECHNICIAN_WORK: "أعمال فنية",
  STAFF_WORK: "أعمال موظفين",
  ELECTRICITY: "كهرباء",
  OTHER: "مصروفات أخرى"
}

type ActionMap = {
  CREATE_PM_ADVANCE: {
    staffId?: string | null
    staffQuery?: string | null
    amount: number | string
    projectId?: string | null
    notes?: string | null
  }
  CREATE_STAFF_ADVANCE: {
    staffId?: string | null
    staffQuery?: string | null
    amount: number | string
    note?: string | null
  }
  UPDATE_STAFF_ADVANCE: {
    advanceId: string
    amount?: number | string | null
    note?: string | null
    staffQuery?: string | null
  }
  DELETE_STAFF_ADVANCE: {
    advanceId: string
    staffQuery?: string | null
  }
  RECORD_ACCOUNTING_NOTE: {
    noteId: string
    sourceType?: "OFFICE_FUND" | "PM_ADVANCE"
    pmAdvanceId?: string | null
  }
  PAY_INVOICE: {
    invoiceId: string
    amount?: number | string | null
    action?: "pay" | "mark-paid"
  }
  CREATE_PAYROLL: {
    month: string
  }
  PAY_PAYROLL: {
    payrollId: string
  }
  LIST_PAYROLLS: {
    // فلترة عامة
    status?: "PENDING" | "PAID" | "ALL"
    month?: string | null           // "2026-02" - شهر محدد
    fromMonth?: string | null       // "2026-01" - بداية فترة
    toMonth?: string | null         // "2026-03" - نهاية فترة
    filterDsl?: string | null       // status = PENDING
    limit?: number | string
    // فلترة حسب المشروع - يعيد حساب الإجماليات لموظفي هذا المشروع فقط
    projectId?: string | null
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
  LIST_INVOICES: {
    projectId?: string | null
    projectName?: string | null
    unitCode?: string | null
    isPaid?: boolean | null
    invoiceType?: "CLAIM" | null
    limit?: number | string
    fromDate?: string | null
    toDate?: string | null
    filterDsl?: string | null
    search?: string | null
  }
  SEARCH_STAFF: {
    query: string
    projectId?: string | null
    limit?: number | string
    onlyWithPendingAdvances?: boolean
  }
  LIST_STAFF_ADVANCES: {
    query?: string | null
    status?: "PENDING" | "DEDUCTED" | "ALL"
    projectId?: string | null
    limit?: number | string
    filterDsl?: string | null
  }
  SEARCH_ACCOUNTING_NOTES: {
    query?: string | null
    status?: "PENDING" | "CONVERTED" | "REJECTED" | "ALL"
    projectId?: string | null
    unitCode?: string | null
    limit?: number | string
    includeConverted?: boolean
    filterDsl?: string | null
  }
  GET_INVOICE_DETAILS: {
    invoiceId?: string | null
    invoiceNumber?: string | null
    projectId?: string | null
  }
}

type RequestBody = {
  action?: string
  senderPhone?: string
  payload?: Record<string, unknown>
}

type AccountantRecord = NonNullable<Awaited<ReturnType<typeof resolveAccountant>>>

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
  data: Data
  message?: string
  humanReadable?: HumanReadable
  suggestions?: Suggestion[]
  meta?: Record<string, unknown>
}

type ActionErrorPayload = {
  success: false
  error: string
  issues?: Record<string, unknown>
  humanReadable?: HumanReadable
  suggestions?: Suggestion[]
  meta?: Record<string, unknown>
}

type HandlerResponse = {
  status: number
  body: ActionSuccessPayload | ActionErrorPayload
}

type ActionHandler<K extends AllowedAction> = (
  accountant: AccountantRecord,
  payload: ActionMap[K]
) => Promise<HandlerResponse>

function buildStaffMatchPayload(match: StaffSearchMatch) {
  return {
    id: match.id,
    name: match.name,
    unitId: match.unitId,
    unitCode: match.unitCode,
    projectId: match.projectId,
    projectName: match.projectName,
    score: match.score,
    pendingAdvanceCount: match.pendingAdvanceCount,
    pendingAdvanceAmount: Number(match.pendingAdvanceAmount.toFixed(2)),
    pendingAdvanceIds: match.pendingAdvanceIds,
    tokens: match.tokens,
    matchBreakdown: match.matchBreakdown
  }
}

function buildStaffSearchMeta(resolution: StaffResolution) {
  return {
    normalizedQuery: resolution.normalizedQuery,
    tokens: resolution.tokens,
    matches: resolution.matches.map((match) => buildStaffMatchPayload(match)),
    chosen: resolution.staff ? buildStaffMatchPayload(resolution.staff) : null
  }
}

function parseLimit(input: unknown, fallback = 10, max = 50) {
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

function formatArabicSource(source: string | null | undefined) {
  if (source === "PM_ADVANCE") {
    return "عهدة مدير المشروع"
  }

  return "صندوق المكتب"
}

function formatArabicExpenseSource(type: ExpenseSourceType) {
  return EXPENSE_SOURCE_LABELS[type] ?? "مصروفات أخرى"
}

function buildArabicConversionSummary(options: {
  note: AccountingNoteWithRelations
  invoice: { invoiceNumber?: string | null; remainingBalance?: number | null }
  expense: { amount: number }
  invoiceCreated: boolean
}) {
  const { note, invoice, expense, invoiceCreated } = options
  const unitName = note.unit?.name ?? "—"
  const unitCode = note.unit?.code ? ` (${note.unit.code})` : ""
  const unitLabel = `${unitName}${unitCode}`
  const amountText = formatCurrency(expense.amount) ?? String(expense.amount)
  const remaining = invoice.remainingBalance ?? 0
  const remainingText = formatCurrency(remaining)
  const lines = [
    `الوحدة: ${unitLabel}`,
    `الوصف: ${note.description ?? "—"}`,
    `المبلغ: ${amountText} جنيه`,
    `مصدر التمويل: ${formatArabicSource(note.sourceType)}`,
    invoiceCreated
      ? `تم إنشاء فاتورة جديدة برقم ${invoice.invoiceNumber ?? "غير محدد"}`
      : `تم تحديث الفاتورة الحالية برقم ${invoice.invoiceNumber ?? "غير محدد"}`,
    `المتبقي على الفاتورة: ${remainingText} جنيه`
  ]

  return lines.join("\n")
}

function normalizeInvoice(invoice: any) {
  if (!invoice) {
    return null
  }

  const unitExpenses = (invoice.expenses ?? []).map((expense: any) => ({
    ...expense,
    date: expense.date ?? expense.createdAt ?? null,
    createdAt: expense.createdAt ?? null,
    sourceType: expense.sourceType ?? "UNIT_EXPENSE"
  }))

  const operationalExpenses = (invoice.operationalExpenses ?? []).map((expense: any) => ({
    id: expense.id,
    description: expense.description,
    amount: expense.amount,
    sourceType: expense.sourceType,
    date: expense.recordedAt ?? expense.createdAt ?? null,
    createdAt: expense.createdAt ?? null
  }))

  const mergedExpenses = [...unitExpenses, ...operationalExpenses].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0
    const bTime = b.date ? new Date(b.date).getTime() : 0
    return bTime - aTime
  })

  const {
    operationalExpenses: _op,
    expenses: _unitExpenses,
    payments: _payments,
    ownerAssociation: rawOwnerAssociation,
    ...rest
  } = invoice

  const ownerContacts = rawOwnerAssociation?.contacts ?? []
  const primaryPhone = ownerContacts.find(
    (contact: any) => contact.type === "PHONE" && contact.isPrimary
  )?.value
  const primaryEmail = ownerContacts.find(
    (contact: any) => contact.type === "EMAIL" && contact.isPrimary
  )?.value

  const ownerAssociation = rawOwnerAssociation
    ? {
        ...rawOwnerAssociation,
        phone: primaryPhone ?? rawOwnerAssociation.phone ?? null,
        email: primaryEmail ?? rawOwnerAssociation.email ?? null,
        contacts: ownerContacts
      }
    : null

  return {
    ...rest,
    expenses: mergedExpenses,
    payments: invoice.payments ?? [],
    ownerAssociation
  }
}

async function resolveAccountant(senderPhone: string) {
  const phoneVariants = buildPhoneVariants(senderPhone)

  if (phoneVariants.length === 0) {
    return null
  }

  return db.user.findFirst({
    where: {
      whatsappPhone: { in: phoneVariants },
      role: {
        in: ["ACCOUNTANT", "ADMIN"]
      }
    },
    select: {
      id: true,
      name: true,
      role: true,
      whatsappPhone: true
    }
  })
}

async function handleCreatePmAdvance(
  accountant: AccountantRecord,
  payload: ActionMap["CREATE_PM_ADVANCE"]
): Promise<HandlerResponse> {
  const { staffId, staffQuery, amount, projectId, notes } = payload
  const numericAmount = Number(amount)

  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Missing or invalid fields for PM advance",
        humanReadable: {
          ar: "من فضلك أرسل قيمة موجبة لتسجيل العهدة."
        }
      }
    }
  }

  const staffResolution = await resolveStaffReference({
    staffId,
    staffQuery,
    projectId
  })

  if (!staffResolution.staff) {
    const matches = staffResolution.matches
    const notFound = matches.length === 0

    return {
      status: notFound ? 404 : 409,
      body: {
        success: false,
        error: notFound ? "Staff member not found" : "Staff match requires confirmation",
        humanReadable: {
          ar: notFound
            ? "لم أعثر على موظف مطابق للوصف."
            : "وجدت أكثر من موظف مطابق، من فضلك حدد الموظف المطلوب لتسجيل العهدة."
        },
        suggestions: matches.length
          ? [
              {
                title: "تأكيد اسم الموظف",
                prompt: "حدد اسم الموظف المقصود لتسجيل العهدة.",
                data: {
                  candidates: matches.map((match) => ({
                    id: match.id,
                    name: match.name,
                    score: match.score,
                    unitCode: match.unitCode,
                    projectId: match.projectId
                  }))
                }
              }
            ]
          : undefined,
        meta: {
          staffSearch: buildStaffSearchMeta(staffResolution)
        }
      }
    }
  }

  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    })

    if (!project) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Project not found",
          humanReadable: {
            ar: "المشروع المحدد غير موجود."
          }
        }
      }
    }
  }

  const advance = await db.pMAdvance.create({
    data: {
      staffId: staffResolution.staff.id,
      projectId: projectId || null,
      amount: numericAmount,
      remainingAmount: numericAmount,
      notes: notes ? String(notes).trim() || null : null
    },
    include: {
      staff: {
        select: { id: true, name: true }
      },
      project: {
        select: { id: true, name: true }
      }
    }
  })

  return {
    status: 201,
    body: {
      success: true,
      data: advance,
      message: "PM advance created",
      humanReadable: {
        ar: `تم تسجيل عهدة بقيمة ${formatCurrency(advance.amount)} بنجاح.`
      },
      meta: {
        staffSearch: buildStaffSearchMeta(staffResolution),
        staffAdvances: buildStaffAdvancesSummary(staffResolution.staff)
      }
    }
  }
}

async function handleCreateStaffAdvance(
  accountant: AccountantRecord,
  payload: ActionMap["CREATE_STAFF_ADVANCE"]
): Promise<HandlerResponse> {
  const { staffId, staffQuery, amount, note } = payload
  const numericAmount = Number(amount)

  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Missing or invalid fields for staff advance",
        humanReadable: {
          ar: "القيمة يجب أن تكون موجبة لتسجيل سلفة الموظف."
        }
      }
    }
  }

  const staffResolution = await resolveStaffReference({
    staffId,
    staffQuery,
    onlyWithPendingAdvances: true
  })

  if (!staffResolution.staff) {
    const matches = staffResolution.matches
    const notFound = matches.length === 0

    return {
      status: notFound ? 404 : 409,
      body: {
        success: false,
        error: notFound ? "Staff member not found" : "Staff match requires confirmation",
        humanReadable: {
          ar: notFound
            ? "لم أعثر على موظف مطابق للوصف."
            : "وجدت أكثر من موظف مطابق، من فضلك حدد الموظف الذي تُصرف له السلفة."
        },
        suggestions: matches.length
          ? [
              {
                title: "تأكيد اسم الموظف",
                prompt: "اختر أو وضّح الموظف الذي تريده للسلفة.",
                data: {
                  candidates: matches.map((match) => ({
                    id: match.id,
                    name: match.name,
                    score: match.score,
                    unitCode: match.unitCode,
                    projectId: match.projectId
                  }))
                }
              }
            ]
          : undefined,
        meta: {
          staffSearch: buildStaffSearchMeta(staffResolution)
        }
      }
    }
  }

  const advance = await db.staffAdvance.create({
    data: {
      staffId: staffResolution.staff.id,
      amount: numericAmount,
      note: note ? String(note).trim() || null : null,
      status: "PENDING",
      date: new Date()
    },
    include: {
      staff: {
        select: { id: true, name: true }
      }
    }
  })

  const baseSummary = buildStaffAdvancesSummary(staffResolution.staff)
  const updatedSummary = baseSummary
    ? {
        ...baseSummary,
        pendingAdvanceCount: baseSummary.pendingAdvanceCount + 1,
        pendingAdvanceAmount: Number((baseSummary.pendingAdvanceAmount + numericAmount).toFixed(2)),
        pendingAdvanceIds: [...baseSummary.pendingAdvanceIds, advance.id]
      }
    : null

  return {
    status: 201,
    body: {
      success: true,
      data: advance,
      message: "Staff advance created",
      humanReadable: {
        ar: `تم تسجيل سلفة بقيمة ${formatCurrency(advance.amount)} بنجاح.`
      },
      meta: {
        staffSearch: buildStaffSearchMeta(staffResolution),
        staffAdvances: updatedSummary
      }
    }
  }
}

async function handleUpdateStaffAdvance(
  accountant: AccountantRecord,
  payload: ActionMap["UPDATE_STAFF_ADVANCE"]
): Promise<HandlerResponse> {
  const { advanceId, amount, note, staffQuery } = payload

  if (!advanceId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Advance id is required",
        humanReadable: {
          ar: "من فضلك أرسل معرف السلفة لتعديلها."
        }
      }
    }
  }

  if (amount === undefined && note === undefined) {
    return {
      status: 400,
      body: {
        success: false,
        error: "No changes provided",
        humanReadable: {
          ar: "أرسل قيمة أو ملاحظة جديدة لتعديل السلفة."
        }
      }
    }
  }

  const queryResolution = staffQuery
    ? await resolveStaffReference({ staffQuery, onlyWithPendingAdvances: true })
    : null

  const advance = await db.staffAdvance.findUnique({
    where: { id: advanceId },
    include: {
      staff: {
        select: { id: true, name: true }
      }
    }
  })

  if (!advance) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Advance not found",
        humanReadable: {
          ar: "لم أعثر على سلفة بهذا المعرف."
        },
        meta: queryResolution
          ? {
              staffSearch: buildStaffSearchMeta(queryResolution)
            }
          : undefined
      }
    }
  }

  if (advance.status !== "PENDING") {
    return {
      status: 400,
      body: {
        success: false,
        error: "Only pending advances can be edited",
        humanReadable: {
          ar: "هذه السلفة تم خصمها ولا يمكن تعديلها."
        }
      }
    }
  }

  const staffResolution = await resolveStaffReference({
    staffId: advance.staffId,
    staffQuery,
    onlyWithPendingAdvances: true
  })

  const updateData: Record<string, unknown> = {}
  let amountDelta = 0

  if (amount !== undefined && amount !== null) {
    const numericAmount = Number(amount)

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Amount must be a positive number",
          humanReadable: {
            ar: "القيمة يجب أن تكون رقماً موجباً."
          },
          meta: {
            staffSearch: buildStaffSearchMeta(staffResolution)
          }
        }
      }
    }

    amountDelta = numericAmount - advance.amount
    updateData.amount = numericAmount
  }

  if (note !== undefined) {
    updateData.note = note ? String(note).trim() || null : null
  }

  const updatedAdvance = await db.staffAdvance.update({
    where: { id: advanceId },
    data: updateData,
    include: {
      staff: {
        select: { id: true, name: true }
      }
    }
  })

  const baseSummary = buildStaffAdvancesSummary(staffResolution.staff)
  const adjustedSummary = baseSummary
    ? {
        ...baseSummary,
        pendingAdvanceAmount: Number((baseSummary.pendingAdvanceAmount + amountDelta).toFixed(2))
      }
    : null

  return {
    status: 200,
    body: {
      success: true,
      data: updatedAdvance,
      message: "Staff advance updated",
      humanReadable: {
        ar: "تم تعديل السلفة بنجاح."
      },
      meta: {
        staffSearch: buildStaffSearchMeta(staffResolution),
        staffAdvances: adjustedSummary
      }
    }
  }
}

async function handleDeleteStaffAdvance(
  accountant: AccountantRecord,
  payload: ActionMap["DELETE_STAFF_ADVANCE"]
): Promise<HandlerResponse> {
  const { advanceId, staffQuery } = payload

  if (!advanceId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Advance id is required",
        humanReadable: {
          ar: "من فضلك أرسل معرف السلفة لحذفها."
        }
      }
    }
  }

  const queryResolution = staffQuery
    ? await resolveStaffReference({ staffQuery, onlyWithPendingAdvances: true })
    : null

  const advance = await db.staffAdvance.findUnique({
    where: { id: advanceId }
  })

  if (!advance) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Advance not found",
        humanReadable: {
          ar: "لم أعثر على سلفة بهذا المعرف."
        },
        meta: queryResolution
          ? {
              staffSearch: buildStaffSearchMeta(queryResolution)
            }
          : undefined
      }
    }
  }

  if (advance.status === "DEDUCTED") {
    return {
      status: 400,
      body: {
        success: false,
        error: "Cannot delete deducted advances",
        humanReadable: {
          ar: "هذه السلفة تم خصمها ولا يمكن حذفها."
        },
        meta: queryResolution
          ? {
              staffSearch: buildStaffSearchMeta(queryResolution)
            }
          : undefined
      }
    }
  }

  const staffResolution = await resolveStaffReference({
    staffId: advance.staffId,
    staffQuery,
    onlyWithPendingAdvances: true
  })

  await db.staffAdvance.delete({
    where: { id: advanceId }
  })

  const baseSummary = buildStaffAdvancesSummary(staffResolution.staff)
  const adjustedSummary = baseSummary
    ? {
        ...baseSummary,
        pendingAdvanceCount: Math.max(0, baseSummary.pendingAdvanceCount - 1),
        pendingAdvanceAmount: Number((baseSummary.pendingAdvanceAmount - advance.amount).toFixed(2)),
        pendingAdvanceIds: baseSummary.pendingAdvanceIds.filter((id) => id !== advanceId)
      }
    : null

  return {
    status: 200,
    body: {
      success: true,
      data: { advanceId },
      message: "Staff advance deleted",
      humanReadable: {
        ar: "تم حذف السلفة بنجاح."
      },
      meta: {
        staffSearch: buildStaffSearchMeta(staffResolution),
        staffAdvances: adjustedSummary
      }
    }
  }
}

async function handleRecordAccountingNote(
  accountant: AccountantRecord,
  payload: ActionMap["RECORD_ACCOUNTING_NOTE"]
): Promise<HandlerResponse> {
  const { noteId, sourceType, pmAdvanceId } = payload

  if (!noteId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Note id is required",
        humanReadable: {
          ar: "أرسل معرف القيد المحاسبي لتسجيله."
        }
      }
    }
  }

  const normalizedSourceType = sourceType ?? undefined

  if (
    normalizedSourceType &&
    normalizedSourceType !== "OFFICE_FUND" &&
    normalizedSourceType !== "PM_ADVANCE"
  ) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid source type",
        humanReadable: {
          ar: "نوع التمويل غير مدعوم."
        }
      }
    }
  }

  try {
    const { note, invoice, expense, invoiceCreated } = await convertAccountingNote({
      noteId,
      requestedSourceType: normalizedSourceType,
      requestedPmAdvanceId: pmAdvanceId ?? null,
      recordedByUserId: accountant.id
    })

    const humanReadableAr = buildArabicConversionSummary({
      note,
      invoice,
      expense,
      invoiceCreated
    })

    return {
      status: 200,
      body: {
        success: true,
        data: {
          note,
          invoice,
          expense
        },
        humanReadable: {
          ar: humanReadableAr
        }
      }
    }
  } catch (error) {
    if (error instanceof AccountingNoteNotFoundError) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Accounting note not found",
          humanReadable: {
            ar: "لم أعثر على قيد محاسبي بهذا المعرف."
          }
        }
      }
    }

    if (error instanceof AccountingNoteMissingUnitError) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Accounting note is missing unit information",
          humanReadable: {
            ar: "لا يوجد وحدة مرتبطة بهذا القيد."
          }
        }
      }
    }

    if (error instanceof AccountingNotePmAdvanceRequiredError) {
      return {
        status: 400,
        body: {
          success: false,
          error: "PM advance is required for PM source",
          humanReadable: {
            ar: "حدد العهدة التي سيموّل منها هذا المصروف."
          }
        }
      }
    }

    if (error instanceof AccountingNotePmAdvanceNotFoundError) {
      return {
        status: 404,
        body: {
          success: false,
          error: "PM advance not found",
          humanReadable: {
            ar: "لم أعثر على هذه العهدة."
          }
        }
      }
    }

    if (error instanceof AccountingNotePmAdvanceInsufficientError) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Insufficient PM advance balance",
          issues: {
            remaining: error.remaining,
            needed: error.needed
          },
          humanReadable: {
            ar: "العهدة لا تحتوي على رصيد كافٍ."
          }
        }
      }
    }

    if (error instanceof AccountingNoteAlreadyProcessedError) {
      const existing = await db.accountingNote.findUnique({
        where: { id: noteId },
        include: {
          convertedToExpense: true
        }
      })

      return {
        status: 409,
        body: {
          success: false,
          error: "This note is already processed",
          meta: {
            note: existing
          },
          humanReadable: {
            ar: "تم تسجيل هذا القيد مسبقاً."
          }
        }
      }
    }

    console.error("Error converting accounting note via webhook:", error)

    return {
      status: 500,
      body: {
        success: false,
        error: "Failed to convert accounting note",
        humanReadable: {
          ar: "حدث خطأ أثناء تسجيل القيد."
        }
      }
    }
  }
}

async function handleSearchStaff(
  accountant: AccountantRecord,
  payload: ActionMap["SEARCH_STAFF"]
): Promise<HandlerResponse> {
  const { query, projectId, limit, onlyWithPendingAdvances } = payload

  if (!query || !String(query).trim()) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Search query is required",
        humanReadable: {
          ar: "أرسل اسم أو جزء من اسم للبحث عن الموظفين."
        }
      }
    }
  }

  const resolvedLimit = parseLimit(limit, 10, 50)
  const searchResult = await searchStaffByName({
    query,
    projectId: projectId ?? undefined,
    limit: resolvedLimit,
    onlyWithPendingAdvances: Boolean(onlyWithPendingAdvances)
  })

  const matches = searchResult.matches.map((match) => buildStaffMatchPayload(match))
  const summary = buildStaffAdvancesSummary(searchResult.staff)

  return {
    status: 200,
    body: {
      success: true,
      data: {
        matches
      },
      message: matches.length ? "Staff search completed" : "No staff matched the query",
      humanReadable: matches.length
        ? {
            ar: `تم العثور على ${matches.length} موظف${matches.length === 1 ? "" : "ين"} مطابقين للبحث.`
          }
        : {
            ar: "لا يوجد موظفون مطابقون للاسم المرسل."
          },
      meta: {
        staffSearch: buildStaffSearchMeta(searchResult),
        staffAdvances: summary
      }
    }
  }
}

async function handleListStaffAdvances(
  accountant: AccountantRecord,
  payload: ActionMap["LIST_STAFF_ADVANCES"]
): Promise<HandlerResponse> {
  const { query, status, projectId, limit, filterDsl } = payload

  const normalizedFilterDsl = typeof filterDsl === "string" ? filterDsl.trim() : ""
  const filterDslResult = normalizedFilterDsl
    ? parseStaffAdvanceFilterDsl(normalizedFilterDsl)
    : { errors: [] as string[] }

  if (filterDslResult.errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid filterDsl expression",
        humanReadable: { ar: "صيغة فلتر DSL غير صحيحة. استخدم مثلاً: amount > 500" },
        issues: { filterDsl, errors: filterDslResult.errors }
      }
    }
  }

  const resolvedLimit = parseLimit(limit, 25, 200)
  const statusFilter = status && status !== "ALL" ? status : undefined

  let staffSearchResolution: StaffResolution | null = null
  let staffIds: string[] | undefined

  if (query && String(query).trim()) {
    staffSearchResolution = await searchStaffByName({
      query,
      projectId: projectId ?? undefined,
      limit: Math.max(resolvedLimit, 10),
      onlyWithPendingAdvances: statusFilter === "PENDING"
    })

    staffIds = staffSearchResolution.matches.map((match) => match.id)

    if (staffIds.length === 0) {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            advances: []
          },
          message: "No staff advances found",
          humanReadable: {
            ar: "لا توجد سلف للموظفين مطابقة للمحددات."
          },
          meta: {
            staffSearch: buildStaffSearchMeta(staffSearchResolution)
          }
        }
      }
    }
  }

  const whereClauses: Prisma.StaffAdvanceWhereInput[] = []

  if (statusFilter) {
    whereClauses.push({ status: statusFilter })
  }

  if (staffIds && staffIds.length) {
    whereClauses.push({ staffId: { in: staffIds } })
  }

  if (projectId) {
    whereClauses.push({
      staff: {
        OR: [
          {
            unit: {
              projectId
            }
          },
          {
            projectAssignments: {
              some: {
                projectId
              }
            }
          }
        ]
      }
    })
  }

  if (filterDslResult.where) {
    whereClauses.push(filterDslResult.where as Prisma.StaffAdvanceWhereInput)
  }

  const where: Prisma.StaffAdvanceWhereInput =
    whereClauses.length === 0
      ? {}
      : whereClauses.length === 1
        ? whereClauses[0]
        : { AND: whereClauses }

  const advances = await db.staffAdvance.findMany({
    where,
    take: resolvedLimit,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          unit: {
            select: {
              id: true,
              code: true,
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
      },
      payroll: {
        select: {
          id: true,
          month: true,
          status: true
        }
      }
    }
  })

  const items = advances.map((advance) => ({
    id: advance.id,
    staffId: advance.staffId,
    staffName: advance.staff?.name ?? null,
    amount: advance.amount,
    status: advance.status,
    date: advance.date,
    note: advance.note ?? null,
    unitCode: advance.staff?.unit?.code ?? null,
    projectId: advance.staff?.unit?.projectId ?? null,
    projectName: advance.staff?.unit?.project?.name ?? null,
    payrollId: advance.deductedFromPayrollId ?? null,
    payrollMonth: advance.payroll?.month ?? null
  }))

  const totalAmount = items.reduce((sum, item) => sum + (item.amount ?? 0), 0)
  const pendingCount = items.filter((item) => item.status === "PENDING").length
  const deductedCount = items.filter((item) => item.status === "DEDUCTED").length

  return {
    status: 200,
    body: {
      success: true,
      data: {
        advances: items
      },
      humanReadable: items.length
        ? {
            ar: `تم العثور على ${items.length} سلفة بإجمالي ${formatCurrency(totalAmount)}.`
          }
        : {
            ar: "لا توجد سلف مطابقة للمحددات."
          },
      meta: {
        filters: {
          status: statusFilter ?? "ALL",
          projectId: projectId ?? null
        },
        totals: {
          count: items.length,
          amount: Number(totalAmount.toFixed(2)),
          pendingCount,
          deductedCount
        },
        staffSearch: staffSearchResolution
          ? buildStaffSearchMeta(staffSearchResolution)
          : undefined
      }
    }
  }
}

async function handleSearchAccountingNotes(
  accountant: AccountantRecord,
  payload: ActionMap["SEARCH_ACCOUNTING_NOTES"]
): Promise<HandlerResponse> {
  const { query, status, projectId, unitCode, limit, includeConverted, filterDsl } = payload

  const normalizedFilterDsl = typeof filterDsl === "string" ? filterDsl.trim() : ""
  const filterDslResult = normalizedFilterDsl
    ? parseAccountingNoteFilterDsl(normalizedFilterDsl)
    : { errors: [] as string[] }

  if (filterDslResult.errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid filterDsl expression",
        humanReadable: { ar: "صيغة فلتر DSL غير صحيحة. مثال: amount > 500 أو status = PENDING" },
        issues: { filterDsl, errors: filterDslResult.errors }
      }
    }
  }

  const resolvedLimit = parseLimit(limit, 25, 150)
  const normalizedQuery = typeof query === "string" ? query.trim() : ""

  const searchAnalysis = normalizedQuery ? analyzeExpenseSearch(normalizedQuery) : null
  const descriptionTokens = searchAnalysis?.descriptionTokens ?? []

  const whereClauses: Prisma.AccountingNoteWhereInput[] = []

  const normalizedStatusFilter = status && status !== "ALL" ? status : null

  if (descriptionTokens.length > 0) {
    const descriptionFilter = buildDescriptionFilter(descriptionTokens)
    if (descriptionFilter) {
      whereClauses.push(descriptionFilter)
    }
  }

  if (normalizedQuery) {
    const searchOr: Prisma.AccountingNoteWhereInput[] = [
      {
        description: {
          contains: normalizedQuery,
          mode: "insensitive"
        } as any
      }
    ]

    if (normalizedQuery.length >= 8) {
      searchOr.push({ id: normalizedQuery })
    }

    if (normalizedQuery.length >= 6) {
      searchOr.push({ pmAdvanceId: normalizedQuery })
    }

    searchOr.push({
      unit: {
        is: {
          code: {
            contains: normalizedQuery,
            mode: "insensitive"
          } as any
        }
      }
    })

    const numericPortion = Number(normalizedQuery.replace(/[^0-9.]/g, ""))
    if (!Number.isNaN(numericPortion) && numericPortion > 0) {
      searchOr.push({ amount: numericPortion })
    }

    whereClauses.push({ OR: searchOr })
  }

  const includeConvertedExplicitly = includeConverted === true
  const applyConvertedExclusion = !normalizedStatusFilter && !includeConvertedExplicitly && !normalizedQuery

  if (normalizedStatusFilter) {
    whereClauses.push({ status: normalizedStatusFilter })
  } else if (applyConvertedExclusion) {
    whereClauses.push({ status: { not: "CONVERTED" } })
  }

  if (projectId) {
    whereClauses.push({ projectId })
  }

  if (unitCode) {
    whereClauses.push({
      unit: {
        is: {
          code: {
            equals: unitCode,
            mode: "insensitive"
          } as any
        }
      }
    })
  }

  if (filterDslResult.where) {
    whereClauses.push(filterDslResult.where as Prisma.AccountingNoteWhereInput)
  }

  const where: Prisma.AccountingNoteWhereInput =
    whereClauses.length === 0
      ? {}
      : whereClauses.length === 1
        ? whereClauses[0]
        : { AND: whereClauses }

  const notes = await db.accountingNote.findMany({
    where,
    take: resolvedLimit,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      unit: {
        select: {
          id: true,
          code: true,
          name: true,
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      project: {
        select: {
          id: true,
          name: true
        }
      },
      pmAdvance: {
        select: {
          id: true,
          amount: true,
          staff: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  })

  const items = notes.map((note) => ({
    id: note.id,
    amount: note.amount,
    status: note.status,
    description: note.description,
    unitCode: note.unit?.code ?? null,
    unitName: note.unit?.name ?? null,
    projectId: note.projectId,
    projectName: note.project?.name ?? null,
    pmAdvanceId: note.pmAdvanceId ?? null,
    pmAdvanceAmount: note.pmAdvance?.amount ?? null,
    pmAdvanceStaff: note.pmAdvance?.staff?.name ?? null,
    createdAt: note.createdAt,
    sourceType: note.sourceType
  }))

  const totalAmount = items.reduce((sum, note) => sum + (note.amount ?? 0), 0)
  const statusesBreakdown = items.reduce<Record<string, { count: number; amount: number }>>((acc, note) => {
    const key = note.status
    if (!acc[key]) {
      acc[key] = { count: 0, amount: 0 }
    }
    acc[key].count += 1
    acc[key].amount += note.amount ?? 0
    return acc
  }, {})

  const statusLabels: Record<string, string> = {
    PENDING: "قيد في انتظار المعالجة",
    CONVERTED: "تم تحويله لمصروف",
    REJECTED: "مرفوض"
  }

  const topNotes = items.slice(0, 6)
  const summaryLines = topNotes.map((note) => {
    const dateLabel = formatDate(note.createdAt) ?? "—"
    const amountLabel = formatCurrency(note.amount ?? 0)
    const statusLabel = statusLabels[note.status] ?? note.status
    const unitLabel = note.unitCode ? ` • الوحدة ${note.unitCode}` : ""
    return `- ${dateLabel}${unitLabel}: ${amountLabel} جنيه — ${note.description ?? "(بدون وصف)"} (${statusLabel})`
  })

  const moreCount = Math.max(items.length - summaryLines.length, 0)

  const humanReadableAr = items.length
    ? [
        `وجدت ${items.length} قيود بقيمة إجمالية ${formatCurrency(totalAmount)} جنيه${normalizedQuery ? ` للبحث عن "${normalizedQuery}"` : ""}.`,
        ...summaryLines,
        moreCount > 0 ? `- (+${moreCount} قيود إضافية) ...` : null
      ]
        .filter(Boolean)
        .join("\n")
    : "لا توجد قيود محاسبية مطابقة للمحددات."

  const effectiveIncludeConverted = normalizedStatusFilter
    ? normalizedStatusFilter === "CONVERTED"
    : !applyConvertedExclusion

  return {
    status: 200,
    body: {
      success: true,
      data: {
        notes: items,
        summary: humanReadableAr,
        topNotes: topNotes
      },
      humanReadable: {
        ar: humanReadableAr
      },
      meta: {
        filters: {
          status: status ?? "ALL",
          projectId: projectId ?? null,
          unitCode: unitCode ?? null,
          includeConverted: effectiveIncludeConverted
        },
        totals: {
          count: items.length,
          amount: Number(totalAmount.toFixed(2)),
          statuses: Object.fromEntries(
            Object.entries(statusesBreakdown).map(([key, value]) => [
              key,
              {
                count: value.count,
                amount: Number(value.amount.toFixed(2))
              }
            ])
          )
        },
        searchAnalysis: searchAnalysis
          ? {
              normalizedSearch: searchAnalysis.descriptionSummary,
              tokens: searchAnalysis.descriptionTokens,
              matchedSourceTypes: Array.from(searchAnalysis.matchedSourceTypes)
            }
          : null
      }
    }
  }
}

async function handlePayInvoice(
  accountant: AccountantRecord,
  payload: ActionMap["PAY_INVOICE"]
): Promise<HandlerResponse> {
  const { invoiceId, amount, action } = payload

  if (!invoiceId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invoice id is required",
        humanReadable: {
          ar: "أرسل معرف الفاتورة لتسجيل الدفع."
        }
      }
    }
  }

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId }
  })

  if (!invoice) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Invoice not found",
        humanReadable: {
          ar: "لم أعثر على فاتورة بهذا المعرف."
        }
      }
    }
  }

  const resolvedAction = action ?? "pay"
  const paymentAmount = resolvedAction === "mark-paid"
    ? invoice.remainingBalance
    : Number(amount)

  if (resolvedAction === "pay" && (amount === undefined || amount === null)) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Payment amount is required",
        humanReadable: {
          ar: "أرسل المبلغ المدفوع للفاتورة."
        }
      }
    }
  }

  if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid payment amount",
        humanReadable: {
          ar: "المبلغ المدفوع يجب أن يكون رقماً موجباً."
        }
      }
    }
  }

  if (paymentAmount > invoice.remainingBalance) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Payment exceeds remaining balance",
        issues: {
          paymentAmount,
          remainingBalance: invoice.remainingBalance
        },
        humanReadable: {
          ar: "المبلغ المدفوع أكبر من الرصيد المتبقي."
        }
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        totalPaid: (invoice.totalPaid || 0) + paymentAmount,
        remainingBalance: invoice.remainingBalance - paymentAmount,
        isPaid: invoice.remainingBalance - paymentAmount <= 0
      }
    })

    await tx.payment.create({
      data: {
        invoiceId,
        amount: paymentAmount
      }
    })
  })

  const refreshed = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      unit: {
        include: {
          project: true
        }
      },
      ownerAssociation: {
        include: {
          contacts: {
            orderBy: { createdAt: "asc" }
          }
        }
      },
      expenses: {
        select: {
          id: true,
          description: true,
          amount: true,
          sourceType: true,
          date: true,
          createdAt: true
        }
      },
      operationalExpenses: {
        select: {
          id: true,
          description: true,
          amount: true,
          sourceType: true,
          recordedAt: true,
          createdAt: true
        }
      },
      payments: {
        select: {
          id: true,
          amount: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  })

  return {
    status: 200,
    body: {
      success: true,
      data: normalizeInvoice(refreshed),
      message: "Invoice payment recorded",
      humanReadable: {
        ar: "تم تسجيل دفعة الفاتورة بنجاح."
      }
    }
  }
}

async function handleCreatePayroll(
  accountant: AccountantRecord,
  payload: ActionMap["CREATE_PAYROLL"]
): Promise<HandlerResponse> {
  const { month } = payload

  if (!month || !String(month).trim()) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Month is required",
        humanReadable: {
          ar: "أرسل شهر المرتبات بصيغة YYYY-MM."
        }
      }
    }
  }

  const existing = await db.payroll.findFirst({
    where: { month }
  })

  if (existing) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Payroll already exists",
        humanReadable: {
          ar: "يوجد كشف رواتب لهذا الشهر بالفعل."
        }
      }
    }
  }

  const staffMembers = await db.staff.findMany({
    include: {
      advances: {
        where: {
          status: "PENDING"
        }
      }
    }
  })

  if (staffMembers.length === 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "No staff members found",
        humanReadable: {
          ar: "لا يوجد موظفون مسجلون لإنشاء كشف الرواتب."
        }
      }
    }
  }

  let totalGross = 0
  let totalAdvances = 0

  const payrollItems = staffMembers.map((staff: any) => {
    const salary = staff.salary || 0
    const advancesTotal = (staff.advances || []).reduce(
      (sum: number, adv: any) => sum + adv.amount,
      0
    )
    const net = salary - advancesTotal

    totalGross += salary
    totalAdvances += advancesTotal

    return {
      staffId: staff.id,
      name: staff.name,
      salary,
      advances: advancesTotal,
      net
    }
  })

  const payroll = await db.payroll.create({
    data: {
      month,
      totalGross,
      totalAdvances,
      totalNet: totalGross - totalAdvances,
      status: "PENDING",
      createdByUserId: accountant.id,
      payrollItems: {
        create: payrollItems
      }
    },
    include: {
      payrollItems: true,
      createdByUser: {
        select: { id: true, name: true }
      }
    }
  })

  return {
    status: 201,
    body: {
      success: true,
      data: payroll,
      message: "Payroll generated",
      humanReadable: {
        ar: "تم إنشاء كشف الرواتب وجاهز للدفع."
      }
    }
  }
}

async function handlePayPayroll(
  accountant: AccountantRecord,
  payload: ActionMap["PAY_PAYROLL"]
): Promise<HandlerResponse> {
  const { payrollId } = payload

  if (!payrollId) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Payroll id is required",
        humanReadable: {
          ar: "أرسل معرف كشف الرواتب لتأكيد الدفع."
        }
      }
    }
  }

  const payroll = await db.payroll.findUnique({
    where: { id: payrollId },
    include: {
      payrollItems: true
    }
  })

  if (!payroll) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Payroll not found",
        humanReadable: {
          ar: "لم أعثر على كشف رواتب بهذا المعرف."
        }
      }
    }
  }

  if (payroll.status !== "PENDING") {
    return {
      status: 400,
      body: {
        success: false,
        error: "Payroll is already processed",
        humanReadable: {
          ar: "تم دفع هذا الكشف مسبقاً."
        }
      }
    }
  }

  const staffIds = payroll.payrollItems.map((item) => item.staffId)

  const pendingAdvances = await db.staffAdvance.findMany({
    where: {
      staffId: { in: staffIds },
      status: "PENDING"
    }
  })

  for (const advance of pendingAdvances) {
    await db.staffAdvance.update({
      where: { id: advance.id },
      data: {
        status: "DEDUCTED",
        deductedFromPayrollId: payrollId
      }
    })
  }

  const updatedPayroll = await db.payroll.update({
    where: { id: payrollId },
    data: {
      status: "PAID",
      paidAt: new Date()
    },
    include: {
      payrollItems: true,
      deductedAdvances: {
        include: {
          staff: {
            select: { id: true, name: true }
          }
        }
      }
    }
  })

  return {
    status: 200,
    body: {
      success: true,
      data: updatedPayroll,
      message: "Payroll marked as paid",
      humanReadable: {
        ar: "تم دفع كشف الرواتب وخصم السلف المعلقة."
      }
    }
  }
}

async function handleListPayrolls(
  _accountant: AccountantRecord,
  payload: ActionMap["LIST_PAYROLLS"]
): Promise<HandlerResponse> {
  const { status, month, fromMonth, toMonth, projectId, filterDsl, limit } = payload

  // ─── Validate & parse filterDsl ───────────────────────────────────────────
  const normalizedFilterDsl = typeof filterDsl === "string" ? filterDsl.trim() : ""
  const filterDslResult = normalizedFilterDsl
    ? parsePayrollFilterDsl(normalizedFilterDsl)
    : { errors: [] as string[], where: undefined }

  if (filterDslResult.errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid filterDsl expression",
        humanReadable: { ar: "صيغة فلتر DSL غير صحيحة. مثال: status = PENDING أو amount > 5000" },
        issues: { filterDsl, errors: filterDslResult.errors }
      }
    }
  }

  const resolvedLimit = parseLimit(limit, 20, 100)

  // ─── Build WHERE clauses ──────────────────────────────────────────────────
  const whereClauses: Prisma.PayrollWhereInput[] = []

  // Filter by status
  const normalizedStatus = status && status !== "ALL" ? status : null
  if (normalizedStatus) {
    whereClauses.push({ status: normalizedStatus })
  }

  // Filter by exact month
  if (month) {
    whereClauses.push({ month: String(month).trim() })
  }

  // Filter by month range (fromMonth–toMonth) — month is stored as "YYYY-MM" string, so string comparison works
  if (!month) {
    const from = typeof fromMonth === "string" ? fromMonth.trim() : null
    const to = typeof toMonth === "string" ? toMonth.trim() : null
    if (from && to) {
      // month >= from AND month <= to
      whereClauses.push({ month: { gte: from } } as any)
      whereClauses.push({ month: { lte: to } } as any)
    } else if (from) {
      whereClauses.push({ month: { gte: from } } as any)
    } else if (to) {
      whereClauses.push({ month: { lte: to } } as any)
    }
  }

  // DSL
  if (filterDslResult.where) {
    whereClauses.push(filterDslResult.where)
  }

  const where: Prisma.PayrollWhereInput =
    whereClauses.length === 0
      ? {}
      : whereClauses.length === 1
        ? whereClauses[0]
        : { AND: whereClauses }

  // ─── Resolve projectId → staff IDs ────────────────────────────────────────
  // Staff can belong to a project via TWO paths:
  //   1. StaffProjectAssignment.projectId (compound/project staff)
  //   2. staff.unit.projectId (staff attached to a unit in that project, e.g. pharmacy)
  let projectStaffIds: Set<string> | null = null

  if (projectId) {
    const [byAssignment, byUnit] = await Promise.all([
      db.staffProjectAssignment.findMany({
        where: { projectId },
        select: { staffId: true }
      }),
      db.staff.findMany({
        where: { unit: { projectId } },
        select: { id: true }
      })
    ])

    projectStaffIds = new Set([
      ...byAssignment.map((a) => a.staffId),
      ...byUnit.map((s) => s.id)
    ])
  }

  // ─── Query payrolls ───────────────────────────────────────────────────────
  const payrolls = await db.payroll.findMany({
    where,
    take: resolvedLimit,
    orderBy: { month: "desc" },
    include: {
      payrollItems: {
        orderBy: { name: "asc" }
      },
      createdByUser: {
        select: { id: true, name: true }
      },
      _count: {
        select: { deductedAdvances: true }
      }
    }
  })

  // ─── Shape response ───────────────────────────────────────────────────────
  const shapedPayrolls = payrolls.map((payroll) => {
    // If project filter is active, slice items to project staff only
    const items = projectStaffIds
      ? payroll.payrollItems.filter((item) => projectStaffIds!.has(item.staffId))
      : payroll.payrollItems

    const projectGross = items.reduce((s, i) => s + i.salary, 0)
    const projectAdvances = items.reduce((s, i) => s + i.advances, 0)
    const projectNet = items.reduce((s, i) => s + i.net, 0)

    return {
      id: payroll.id,
      month: payroll.month,
      status: payroll.status,
      paidAt: payroll.paidAt ?? null,
      createdAt: payroll.createdAt,
      createdBy: payroll.createdByUser?.name ?? null,
      // global totals (full payroll)
      totalGross: payroll.totalGross,
      totalAdvances: payroll.totalAdvances,
      totalNet: payroll.totalNet,
      // project-scoped totals (same as global when no projectId filter)
      scopedGross: projectStaffIds ? projectGross : payroll.totalGross,
      scopedAdvances: projectStaffIds ? projectAdvances : payroll.totalAdvances,
      scopedNet: projectStaffIds ? projectNet : payroll.totalNet,
      staffCount: items.length,
      deductedAdvancesCount: payroll._count.deductedAdvances,
      // items — only scoped staff when projectId given
      items: items.map((item) => ({
        staffId: item.staffId,
        name: item.name,
        salary: item.salary,
        advances: item.advances,
        net: item.net
      }))
    }
  })

  // ─── Summary ──────────────────────────────────────────────────────────────
  const totalPayrolls = shapedPayrolls.length
  const pendingCount = shapedPayrolls.filter((p) => p.status === "PENDING").length
  const paidCount = shapedPayrolls.filter((p) => p.status === "PAID").length
  const grandNet = shapedPayrolls.reduce((s, p) => s + p.scopedNet, 0)

  const summaryLines: string[] = [
    `وجدت ${totalPayrolls} كشف رواتب${projectId ? " (مفلترة حسب الموظفين في هذا المشروع)" : ""}.`,
    `• معلقة: ${pendingCount} — مدفوعة: ${paidCount}`,
    `• إجمالي الصافي: ${formatCurrency(grandNet)} جنيه`,
  ]

  for (const p of shapedPayrolls.slice(0, 5)) {
    const statusAr = p.status === "PAID" ? "✓ مدفوع" : "⏳ معلق"
    summaryLines.push(
      `- ${p.month}: ${formatCurrency(p.scopedNet)} جنيه (${p.staffCount} موظف) — ${statusAr}`
    )
  }
  if (totalPayrolls > 5) summaryLines.push(`- (+${totalPayrolls - 5} كشوف إضافية) ...`)

  const humanReadableAr = summaryLines.join("\n")

  return {
    status: 200,
    body: {
      success: true,
      data: {
        payrolls: shapedPayrolls,
        summary: humanReadableAr
      },
      humanReadable: { ar: humanReadableAr },
      meta: {
        count: totalPayrolls,
        pendingCount,
        paidCount,
        grandNet: Number(grandNet.toFixed(2)),
        filters: {
          status: status ?? "ALL",
          month: month ?? null,
          fromMonth: fromMonth ?? null,
          toMonth: toMonth ?? null,
          projectId: projectId ?? null,
          filterDsl: filterDsl ?? null
        },
        projectScopedNote: projectStaffIds
          ? `الإجماليات المعروضة محسوبة لـ ${projectStaffIds.size} موظف مرتبطين بالمشروع فقط (عبر التكليف أو الوحدة).`
          : null
      }
    }
  }
}

async function handleListUnitExpenses(
  accountant: AccountantRecord,
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

  let resolvedProjectId = typeof rawProjectId === "string" && rawProjectId.trim().length > 0
    ? rawProjectId.trim()
    : null

  let project: { id: string; name: string | null } | null = null

  if (normalizedProjectName && !resolvedProjectId) {
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
      project = exactMatch
    } else if (matchedCandidates.length === 1) {
      project = matchedCandidates[0]
    }

    if (!project) {
      return {
        status: matchedCandidates.length > 1 ? 409 : 404,
        body: {
          success: false,
          error: matchedCandidates.length > 1 ? "Project name ambiguous" : "Project not found",
          humanReadable: {
            ar:
              matchedCandidates.length > 1
                ? "اسم المشروع الذي أرسلته يطابق أكثر من مشروع. حدد الاسم الكامل من القائمة."
                : "لم أجد مشروعًا بهذا الاسم أثناء البحث عن المصروفات."
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

    resolvedProjectId = project.id
  }

  if (resolvedProjectId) {
    project = await db.project.findUnique({
      where: { id: resolvedProjectId },
      select: {
        id: true,
        name: true
      }
    })

    if (!project) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Project not found",
          humanReadable: {
            ar: "لم أجد المشروع المطلوب لعرض مصروفاته."
          }
        }
      }
    }

    if (project && normalizedProjectName && project.name && project.name.toLowerCase().trim() !== normalizedProjectName.toLowerCase()) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Project identifier mismatch",
          humanReadable: {
            ar: "المعرف والاسم المشار إليهما يعودان لمشروعين مختلفين."
          },
          issues: {
            projectId: resolvedProjectId,
            projectName: normalizedProjectName,
            matchedProjectName: project.name
          }
        }
      }
    }
  }

  let unit: { id: string; code: string | null; name: string | null; projectId: string } | null = null

  if (unitCode) {
    unit = await db.operationalUnit.findFirst({
      where: {
        code: unitCode,
        ...(project ? { projectId: project.id } : {})
      },
      select: {
        id: true,
        code: true,
        name: true,
        projectId: true
      }
    })

    if (!unit) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Operational unit not found",
          humanReadable: {
            ar: "لم أجد هذه الوحدة أثناء تحضير قائمة المصروفات."
          },
          issues: {
            unitCode
          }
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
  let searchAnalysis: ReturnType<typeof analyzeExpenseSearch> | null = null

  if (rawSearchTerm) {
    searchAnalysis = analyzeExpenseSearch(rawSearchTerm)
    matchedSourceTypes = searchAnalysis.matchedSourceTypes
    descriptionTokensForFilter = searchAnalysis.descriptionTokens
    cleanedSearchTerm = searchAnalysis.descriptionSummary
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
  const filterDslResult = normalizedFilterDsl ? parseExpenseFilterDsl(normalizedFilterDsl) : { errors: [] as string[] }

  if (filterDslResult.errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid filterDsl expression",
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
        humanReadable: {
          ar: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية."
        }
      }
    }
  }

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

  const baseWhereClauses: Prisma.UnitExpenseWhereInput[] = []

  if (project) {
    baseWhereClauses.push({
      unit: {
        projectId: project.id
      }
    })
  }

  if (unit) {
    baseWhereClauses.push({ unitId: unit.id })
  }

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

  const whereClause: Prisma.UnitExpenseWhereInput | undefined =
    currentWhereClauses.length === 0
      ? undefined
      : currentWhereClauses.length === 1
        ? currentWhereClauses[0]
        : { AND: currentWhereClauses }

  const sharedExpenseInclude = {
    unit: {
      select: {
        id: true,
        code: true,
        name: true,
        project: {
          select: {
            id: true,
            name: true
          }
        }
      }
    },
    recordedByUser: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    pmAdvance: {
      select: {
        id: true,
        amount: true,
        remainingAmount: true,
        staff: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }
  } as const

  const take = parseLimit(limit, 25, 100)

  const unitExpenses = shouldSkipQuery
    ? []
    : await db.unitExpense.findMany({
        where: whereClause,
        include: sharedExpenseInclude,
        orderBy: { date: "desc" },
        take
      })

  type ConvertedExclusionReason = "SKIPPED_QUERY" | "SOURCE_TYPE_FILTER" | "FILTER_DSL_APPLIED"

  let convertedExclusionReason: ConvertedExclusionReason | null = null

  if (shouldSkipQuery) {
    convertedExclusionReason = "SKIPPED_QUERY"
  } else if (finalTypeSet && finalTypeSet.size > 0 && !finalTypeSet.has("OTHER")) {
    convertedExclusionReason = "SOURCE_TYPE_FILTER"
  } else if (filterDslResult.where) {
    convertedExclusionReason = "FILTER_DSL_APPLIED"
  }

  const includeConvertedNotes = convertedExclusionReason === null

  const normalizedOperationalDateFilters: Prisma.DateTimeFilter = {}
  if (dateFilters.gte) {
    normalizedOperationalDateFilters.gte = dateFilters.gte
  }
  if (dateFilters.lte) {
    normalizedOperationalDateFilters.lte = dateFilters.lte
  }

  const buildOperationalWhereClauses = (
    dateFilter?: Prisma.DateTimeFilter
  ): Prisma.OperationalExpenseWhereInput => {
    const clauses: Prisma.OperationalExpenseWhereInput[] = [
      {
        convertedFromNoteId: {
          not: null
        }
      }
    ]

    if (project) {
      clauses.push({
        unit: {
          projectId: project.id
        }
      })
    }

    if (unit) {
      clauses.push({ unitId: unit.id })
    }

    if (descriptionFilter) {
      clauses.push(descriptionFilter as unknown as Prisma.OperationalExpenseWhereInput)
    }

    if (dateFilter && Object.keys(dateFilter).length > 0) {
      clauses.push({ recordedAt: dateFilter })
    }

    return clauses.length === 1
      ? clauses[0]
      : { AND: clauses }
  }

  const convertedExpenseInclude = {
    ...sharedExpenseInclude,
    accountingNote: {
      select: {
        id: true,
        description: true,
        convertedAt: true,
        status: true,
        amount: true
      }
    }
  } as const

  type ConvertedExpenseRecord = Prisma.OperationalExpenseGetPayload<{
    include: typeof convertedExpenseInclude
  }>

  let convertedOperationalExpenses: ConvertedExpenseRecord[] = []

  if (includeConvertedNotes) {
    const operationalWhere = buildOperationalWhereClauses(normalizedOperationalDateFilters)

    convertedOperationalExpenses = await db.operationalExpense.findMany({
      where: operationalWhere,
      include: convertedExpenseInclude,
      orderBy: { recordedAt: "desc" },
      take
    })
  }

  type UnitExpenseRecord = (typeof unitExpenses)[number]

  type NormalizedExpense = {
    id: string
    unitId: string
    pmAdvanceId: string | null
    date: Date | null
    recordedAt: Date | null
    description: string | null
    amount: number
    sourceType: ExpenseSourceType
    recordedByUserId: string | null
    unit: {
      id: string
      code: string | null
      name: string | null
      project: {
        id: string
        name: string | null
      } | null
    } | null
    recordedByUser: {
      id: string
      name: string | null
      email: string | null
    } | null
    pmAdvance: {
      id: string
      amount: number
      remainingAmount: number
      staff: {
        id: string
        name: string | null
      } | null
    } | null
    createdAt: Date | null
    updatedAt: Date | null
    recordKind: "UNIT" | "CONVERTED_NOTE"
    operationalSourceType: string | null
    accountingNoteId: string | null
    accountingNoteDescription: string | null
    accountingNoteConvertedAt: Date | null
    accountingNoteStatus: string | null
    convertedOperationalExpenseId: string | null
    convertedFromNoteId: string | null
    originalUnitExpenseId: string | null
  }

  const normalizeUnitExpense = (expense: UnitExpenseRecord): NormalizedExpense => {
    const fallbackDate = expense.date ?? expense.createdAt ?? null

    return {
      id: expense.id,
      unitId: expense.unitId,
      pmAdvanceId: expense.pmAdvanceId ?? null,
      date: fallbackDate,
      recordedAt: fallbackDate,
      description: expense.description ?? null,
      amount: Number(expense.amount ?? 0),
      sourceType: expense.sourceType as ExpenseSourceType,
      recordedByUserId: expense.recordedByUserId ?? null,
      unit: expense.unit ?? null,
      recordedByUser: expense.recordedByUser ?? null,
      pmAdvance: expense.pmAdvance ?? null,
      createdAt: expense.createdAt ?? null,
      updatedAt: expense.updatedAt ?? null,
      recordKind: "UNIT",
      operationalSourceType: null,
      accountingNoteId: null,
      accountingNoteDescription: null,
      accountingNoteConvertedAt: null,
      accountingNoteStatus: null,
      convertedOperationalExpenseId: null,
      convertedFromNoteId: null,
      originalUnitExpenseId: expense.id
    }
  }

  const normalizeConvertedExpense = (expense: ConvertedExpenseRecord): NormalizedExpense => {
    const recordedAt = expense.recordedAt ?? expense.createdAt ?? null

    return {
      id: expense.id,
      unitId: expense.unitId,
      pmAdvanceId: expense.pmAdvanceId ?? null,
      date: recordedAt,
      recordedAt,
      description: expense.description ?? null,
      amount: Number(expense.amount ?? 0),
      sourceType: "OTHER",
      recordedByUserId: expense.recordedByUserId ?? null,
      unit: expense.unit ?? null,
      recordedByUser: expense.recordedByUser ?? null,
      pmAdvance: expense.pmAdvance ?? null,
      createdAt: expense.createdAt ?? null,
      updatedAt: expense.updatedAt ?? null,
      recordKind: "CONVERTED_NOTE",
      operationalSourceType: expense.sourceType ?? null,
      accountingNoteId: expense.accountingNote?.id ?? null,
      accountingNoteDescription: expense.accountingNote?.description ?? null,
      accountingNoteConvertedAt: expense.accountingNote?.convertedAt ?? null,
      accountingNoteStatus: expense.accountingNote?.status ?? null,
      convertedOperationalExpenseId: expense.id,
      convertedFromNoteId: expense.convertedFromNoteId ?? null,
      originalUnitExpenseId: null
    }
  }

  const normalizedUnitExpenses = unitExpenses.map(normalizeUnitExpense)
  const normalizedConvertedExpenses = convertedOperationalExpenses.map(normalizeConvertedExpense)

  const combinedExpenses: NormalizedExpense[] = [
    ...normalizedUnitExpenses,
    ...normalizedConvertedExpenses
  ]

  combinedExpenses.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : a.recordedAt ? new Date(a.recordedAt).getTime() : 0
    const bTime = b.date ? new Date(b.date).getTime() : b.recordedAt ? new Date(b.recordedAt).getTime() : 0
    return bTime - aTime
  })

  const finalExpenses = combinedExpenses.slice(0, take)

  const totalAmount = finalExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  const sourceBreakdown = finalExpenses.reduce((acc, expense) => {
    const key = expense.sourceType as ExpenseSourceType
    acc[key] = acc[key] ?? { count: 0, amount: 0 }
    acc[key].count += 1
    acc[key].amount += expense.amount
    return acc
  }, {} as Record<ExpenseSourceType, { count: number; amount: number }>)

  const averageExpense = finalExpenses.length > 0 ? Number((totalAmount / finalExpenses.length).toFixed(2)) : 0

  const convertedCountInFinal = finalExpenses.filter((expense) => expense.recordKind === "CONVERTED_NOTE").length
  const unitCountInFinal = finalExpenses.length - convertedCountInFinal

  const amountByRecordKind = finalExpenses.reduce(
    (acc, expense) => {
      if (expense.recordKind === "CONVERTED_NOTE") {
        acc.converted += expense.amount
      } else {
        acc.unit += expense.amount
      }
      return acc
    },
    { unit: 0, converted: 0 }
  )

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

    const previousUnitTotalRaw = previousAggregate._sum.amount ?? 0
    const previousUnitTotal =
      typeof previousUnitTotalRaw === "number"
        ? previousUnitTotalRaw
        : Number(previousUnitTotalRaw)

    let previousTotal = previousUnitTotal

    if (includeConvertedNotes) {
      const previousOperationalWhere = buildOperationalWhereClauses(previousDateFilter)
      const previousOperationalAggregate = await db.operationalExpense.aggregate({
        where: previousOperationalWhere,
        _sum: { amount: true }
      })
      const previousOperationalTotalRaw = previousOperationalAggregate._sum.amount ?? 0
      const previousOperationalTotal =
        typeof previousOperationalTotalRaw === "number"
          ? previousOperationalTotalRaw
          : Number(previousOperationalTotalRaw)
      previousTotal += previousOperationalTotal
    }

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

  const topExpenses = finalExpenses.slice(0, 5)

  const reportLines: string[] = []
  reportLines.push("📊 تقرير المصروفات")
  reportLines.push(`• الإجمالي: ${formatCurrency(totalAmount)} جنيه`)
  reportLines.push(`• عدد العمليات: ${finalExpenses.length}`)
  if (convertedCountInFinal > 0) {
    reportLines.push(
      convertedCountInFinal === 1
        ? "• يشمل مصروفًا محولًا من الملاحظات."
        : `• يشمل ${convertedCountInFinal} مصروفات محولة من الملاحظات.`
    )
  }
  if (appliedSourceTypesForFilter.length > 0 || matchedSourceTypes.size > 0) {
    const appliedTypes = appliedSourceTypesForFilter.length
      ? appliedSourceTypesForFilter
      : Array.from(matchedSourceTypes)
    if (appliedTypes.length > 0) {
      reportLines.push(
        `• أنواع المصادر: ${appliedTypes
          .map((type) => formatArabicExpenseSource(type))
          .join("، ")}`
      )
    }
  }
  if (fromDateValue || toDateValue) {
    reportLines.push(
      `• الفترة: ${formatDate(fromDateValue) ?? "—"} → ${formatDate(toDateValue) ?? "—"}`
    )
  }
  if (finalExpenses.length > 0) {
    reportLines.push(`• متوسط العملية: ${formatCurrency(averageExpense)} جنيه`)
  }
  if (topCategory) {
    reportLines.push(
      `• أعلى فئة: ${formatArabicExpenseSource(topCategory.type)} — ${formatCurrency(topCategory.total)} جنيه (${topCategory.count} عملية)`
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
      const unitLabel = expense.unit?.code ?? expense.unit?.name ?? "—"
      const description = expense.description?.trim() || "(بدون وصف)"
      const amountLabel = formatCurrency(expense.amount)
      const dateLabel = formatDate(expense.date ?? expense.recordedAt) ?? "—"
      const convertedMarker = expense.recordKind === "CONVERTED_NOTE" ? " [محولة]" : ""
      reportLines.push(`- ${dateLabel} • ${unitLabel}: ${amountLabel} جنيه — ${description}${convertedMarker}`)
    }
    if (finalExpenses.length > topExpenses.length) {
      reportLines.push(`- (+${finalExpenses.length - topExpenses.length} مصروف إضافي) ...`)
    }
  }

  const structuredReport = {
    summary: reportLines.join("\n"),
    totalAmount,
    rawCount: finalExpenses.length,
    averageExpense,
    topCategory: topCategory
      ? {
          sourceType: topCategory.type,
          label: formatArabicExpenseSource(topCategory.type),
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
      recordKind: expense.recordKind,
      operationalSourceType: expense.operationalSourceType,
      accountingNoteId: expense.accountingNoteId,
      accountingNoteDescription: expense.accountingNoteDescription,
      accountingNoteConvertedAt: expense.accountingNoteConvertedAt,
      accountingNoteStatus: expense.accountingNoteStatus,
      unitCode: expense.unit?.code ?? null,
      unitName: expense.unit?.name ?? null,
      projectId: expense.unit?.project?.id ?? null,
      projectName: expense.unit?.project?.name ?? null,
      description: expense.description,
      amount: expense.amount,
      date: expense.date ?? expense.recordedAt ?? null,
      sourceType: expense.sourceType
    })),
    recordComposition: {
      unit: {
        count: unitCountInFinal,
        amount: Number(amountByRecordKind.unit.toFixed(2))
      },
      converted: {
        count: convertedCountInFinal,
        amount: Number(amountByRecordKind.converted.toFixed(2))
      }
    },
    filters: {
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      unitCode: unit?.code ?? null,
      search: rawSearchTerm,
      fromDate: fromDateValue ? formatDate(fromDateValue) : null,
      toDate: toDateValue ? formatDate(toDateValue) : null,
      sourceTypes: appliedSourceTypesForFilter,
      includeConvertedNotes
    }
  }

  const projectLabel = project?.name ?? project?.id ?? "all projects"
  const unitLabel = unit?.code ?? null

  const humanReadable: HumanReadable = finalExpenses.length
    ? {
        ar: `تم العثور على ${finalExpenses.length} مصروف${finalExpenses.length === 1 ? "" : "ات"} للوحدات ضمن ${projectLabel}${unitLabel ? ` (الوحدة ${unitLabel})` : ""} بإجمالي ${formatCurrency(totalAmount)}${convertedCountInFinal > 0 ? " (يتضمن مصروفات محولة من الملاحظات)." : "."}`
      }
    : {
        ar: "لا توجد مصروفات وحدات مطابقة للمحددات."
      }

  const suggestions: Suggestion[] = []

  if (finalExpenses.length > 0) {
    suggestions.push({
      title: "تحليل حسب المصدر",
      prompt: "حلل لي المصروفات دي حسب نوع المصدر وسلمني الإجمالي لكل نوع.",
      data: {
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        unitCode: unit?.code ?? null,
        search: rawSearchTerm
      }
    })

    const firstUnitExpense = finalExpenses.find((expense) => expense.recordKind === "UNIT")
    if (firstUnitExpense) {
      suggestions.push({
        title: "أحدث مصروف",
        prompt: "هات تفاصيل أحدث مصروف في القائمة اللي استرجعتها.",
        data: {
          expenseId: firstUnitExpense.id,
          recordKind: firstUnitExpense.recordKind
        }
      })
    }

    const firstConvertedExpense = finalExpenses.find((expense) => expense.recordKind === "CONVERTED_NOTE" && expense.accountingNoteId)
    if (firstConvertedExpense && firstConvertedExpense.accountingNoteId) {
      suggestions.push({
        title: "ملاحظة محولة",
        prompt: "هات تفاصيل الملاحظة المحولة المرتبطة بالمصروف ده.",
        data: {
          accountingNoteId: firstConvertedExpense.accountingNoteId,
          expenseId: firstConvertedExpense.id,
          recordKind: firstConvertedExpense.recordKind
        }
      })
    }
  } else {
    suggestions.push({
      title: "تخفيف المحددات",
      prompt: "خفف الفلاتر أو وسّع نطاق التاريخ وجرب مرة تانية.",
      data: {
        projectId: project?.id ?? null,
        unitCode,
        search: rawSearchTerm
      }
    })
  }

  const tokenVariants = searchAnalysis
    ? Object.fromEntries(Array.from(searchAnalysis.tokenVariants.entries()))
    : {}

  return {
    status: 200,
    body: {
      success: true,
      data: {
        expenses: finalExpenses,
        report: structuredReport
      },
      meta: {
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        unitCode: unit?.code ?? null,
        count: finalExpenses.length,
        totalAmount,
        filteredSourceTypes: appliedSourceTypesForFilter,
        requestedSourceTypes: explicitSourceTypes,
        detectedSourceTypesFromSearch: Array.from(matchedSourceTypes),
        search: rawSearchTerm,
        descriptionSearchTerm: cleanedSearchTerm,
        descriptionTokens: descriptionTokensForFilter,
        normalizedSearch: searchAnalysis?.normalizedSearch ?? null,
        tokenVariants,
        skippedQueryBecauseOfFilters: shouldSkipQuery,
        dateFilter: {
          from: formatDate(fromDateValue),
          to: formatDate(toDateValue)
        },
        breakdownBySourceType: sourceBreakdown,
        averageExpense,
        topCategory: topCategory
          ? {
              sourceType: topCategory.type,
              label: formatArabicExpenseSource(topCategory.type),
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
        recordComposition: {
          unit: {
            count: unitCountInFinal,
            amount: Number(amountByRecordKind.unit.toFixed(2))
          },
          converted: {
            count: convertedCountInFinal,
            amount: Number(amountByRecordKind.converted.toFixed(2))
          }
        },
        convertedNotes: {
          included: includeConvertedNotes,
          includedCount: convertedCountInFinal,
          fetchedCount: normalizedConvertedExpenses.length,
          exclusionReason: convertedExclusionReason,
          amount: Number(amountByRecordKind.converted.toFixed(2))
        },
        limit: take,
        reportSummary: structuredReport.summary
      },
      humanReadable,
      suggestions,
      message: finalExpenses.length === 0 ? "لا توجد مصروفات مطابقة للمحددات الحالية" : undefined
    }
  }
}

async function handleListInvoices(
  accountant: AccountantRecord,
  payload: ActionMap["LIST_INVOICES"]
): Promise<HandlerResponse> {
  const {
    projectId: rawProjectId,
    projectName,
    unitCode,
    isPaid,
    invoiceType,
    limit,
    fromDate,
    toDate,
    filterDsl,
    search
  } = payload

  const normalizedSearch =
    typeof search === "string" && search.trim().length > 0 ? search.trim() : null

  const normalizedProjectName =
    typeof projectName === "string" && projectName.trim().length > 0
      ? projectName.trim()
      : null

  let resolvedProjectId = typeof rawProjectId === "string" && rawProjectId.trim().length > 0
    ? rawProjectId.trim()
    : null

  let project: { id: string; name: string | null } | null = null

  if (normalizedProjectName && !resolvedProjectId) {
    const candidates = await db.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
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
      project = exactMatch
    } else if (matchedCandidates.length === 1) {
      project = matchedCandidates[0]
    }

    if (!project) {
      return {
        status: matchedCandidates.length > 1 ? 409 : 404,
        body: {
          success: false,
          error: matchedCandidates.length > 1 ? "Project name ambiguous" : "Project not found",
          humanReadable: {
            ar: matchedCandidates.length > 1
              ? "اسم المشروع يطابق أكثر من مشروع. حدد الاسم الكامل من القائمة."
              : "لم أجد مشروعًا بهذا الاسم أثناء البحث عن الفواتير."
          },
          issues: {
            projectName: normalizedProjectName,
            matchedProjectNames: matchedCandidates.map((c) => c.name)
          }
        }
      }
    }

    resolvedProjectId = project.id
  }

  if (resolvedProjectId) {
    project = await db.project.findUnique({
      where: { id: resolvedProjectId },
      select: { id: true, name: true }
    })

    if (!project) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Project not found",
          humanReadable: { ar: "لم أجد المشروع المطلوب." }
        }
      }
    }
  }

  let unit: { id: string; code: string | null; projectId: string } | null = null

  if (unitCode) {
    unit = await db.operationalUnit.findFirst({
      where: {
        code: unitCode,
        ...(project ? { projectId: project.id } : {})
      },
      select: { id: true, code: true, projectId: true }
    })

    if (!unit) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Operational unit not found",
          humanReadable: { ar: "لم أجد هذه الوحدة." },
          issues: { unitCode }
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
        humanReadable: { ar: "صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD." }
      }
    }
  }

  if (fromDateValue && toDateValue && fromDateValue > toDateValue) {
    return {
      status: 400,
      body: {
        success: false,
        error: "fromDate must be before toDate",
        humanReadable: { ar: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية." }
      }
    }
  }

  if (fromDateValue) {
    fromDateValue.setHours(0, 0, 0, 0)
  }
  if (toDateValue) {
    toDateValue.setHours(23, 59, 59, 999)
  }

  const normalizedFilterDsl = typeof filterDsl === "string" ? filterDsl.trim() : ""
  const filterDslResult = normalizedFilterDsl ? parseInvoiceFilterDsl(normalizedFilterDsl) : { errors: [] as string[] }

  if (filterDslResult.errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Invalid filterDsl expression",
        humanReadable: { ar: "صيغة فلتر DSL غير صحيحة. راجع الصياغة وحاول مرة أخرى." },
        issues: {
          filterDsl,
          errors: filterDslResult.errors
        }
      }
    }
  }

  const dateFilters: Prisma.DateTimeFilter = {}
  if (fromDateValue) {
    dateFilters.gte = fromDateValue
  }
  if (toDateValue) {
    dateFilters.lte = toDateValue
  }

  const whereClauses: Prisma.InvoiceWhereInput[] = []

  if (project) {
    whereClauses.push({
      unit: { projectId: project.id }
    })
  }

  if (unit) {
    whereClauses.push({ unitId: unit.id })
  }

  if (isPaid !== null && isPaid !== undefined) {
    whereClauses.push({
      isPaid: isPaid === true
    })
  }

  const resolvedInvoiceType = invoiceType ?? "CLAIM"
  whereClauses.push({ type: resolvedInvoiceType })

  if (Object.keys(dateFilters).length > 0) {
    whereClauses.push({ issuedAt: dateFilters })
  }

  if (filterDslResult.where) {
    whereClauses.push(filterDslResult.where as unknown as Prisma.InvoiceWhereInput)
  }

  if (normalizedSearch) {
    whereClauses.push({
      OR: [
        { invoiceNumber: { contains: normalizedSearch, mode: "insensitive" } as any },
        { unit: { code: { contains: normalizedSearch, mode: "insensitive" } as any } },
        { ownerAssociation: { name: { contains: normalizedSearch, mode: "insensitive" } as any } }
      ]
    })
  }

  const where: Prisma.InvoiceWhereInput =
    whereClauses.length === 0
      ? {}
      : whereClauses.length === 1
        ? whereClauses[0]
        : { AND: whereClauses }

  const take = parseLimit(limit, 25, 100)

  const invoices = await db.invoice.findMany({
    where,
    include: {
      unit: {
        select: {
          id: true,
          code: true,
          name: true,
          project: {
            select: { id: true, name: true }
          }
        }
      },
      ownerAssociation: {
        select: {
          id: true,
          name: true
        }
      },
      payments: {
        select: { id: true, amount: true, createdAt: true }
      }
    },
    orderBy: { issuedAt: "desc" },
    take
  })

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0)
  const remainingBalance = invoices.reduce((sum, inv) => sum + (inv.remainingBalance ?? 0), 0)
  const paidCount = invoices.filter((inv) => inv.isPaid).length
  const unpaidCount = invoices.length - paidCount

  const items = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    type: inv.type,
    unitCode: inv.unit?.code ?? null,
    unitName: inv.unit?.name ?? null,
    projectId: inv.unit?.project?.id ?? null,
    projectName: inv.unit?.project?.name ?? null,
    amount: inv.amount,
    totalPaid: inv.totalPaid,
    remainingBalance: inv.remainingBalance,
    isPaid: inv.isPaid,
    issuedAt: inv.issuedAt,
    paymentCount: inv.payments?.length ?? 0
  }))

  const projectLabel = project?.name ?? project?.id ?? "جميع المشاريع"
  const unitLabel = unit?.code ?? null
  const paidLabel = isPaid !== null && isPaid !== undefined
    ? (isPaid ? "مدفوعة" : "غير مدفوعة")
    : "الكل"

  const humanReadable: HumanReadable = items.length
    ? {
        ar: `تم العثور على ${items.length} فاتورة${items.length === 1 ? "" : "ة"} (${paidLabel}) ضمن ${projectLabel}${unitLabel ? ` (الوحدة ${unitLabel})` : ""} بإجمالي ${formatCurrency(totalAmount)} جنيه${remainingBalance > 0 ? ` (${formatCurrency(remainingBalance)} متبقي)` : ""}.`
      }
    : {
        ar: "لا توجد فواتير مطابقة للمحددات."
      }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        invoices: items
      },
      humanReadable,
      meta: {
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        unitCode: unit?.code ?? null,
        isPaid: isPaid ?? null,
        invoiceType: resolvedInvoiceType,
        count: items.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalPaid: Number(invoices.reduce((s, i) => s + (i.totalPaid ?? 0), 0).toFixed(2)),
        remainingBalance: Number(remainingBalance.toFixed(2)),
        paidCount,
        unpaidCount,
        dateFilter: {
          from: formatDate(fromDateValue),
          to: formatDate(toDateValue)
        },
        limit: take
      },
      message: items.length === 0 ? "لا توجد فواتير مطابقة للمحددات الحالية" : undefined
    }
  }
}

async function handleGetInvoiceDetails(
  _accountant: AccountantRecord,
  payload: ActionMap["GET_INVOICE_DETAILS"]
): Promise<HandlerResponse> {
  const { invoiceId, invoiceNumber, projectId } = payload

  if (!invoiceId && !invoiceNumber) {
    return {
      status: 400,
      body: {
        success: false,
        error: "invoiceId or invoiceNumber is required",
        humanReadable: { ar: "يجب تحديد رقم الفاتورة (invoiceId أو invoiceNumber) لعرض التفاصيل." }
      }
    }
  }

  let where: Prisma.InvoiceWhereInput

  if (invoiceId) {
    where = { id: invoiceId }
  } else {
    where = projectId
      ? { invoiceNumber: invoiceNumber!, unit: { projectId } }
      : { invoiceNumber: invoiceNumber! }
  }

  const invoice = await db.invoice.findFirst({
    where,
    include: {
      unit: {
        select: {
          id: true,
          code: true,
          name: true,
          project: { select: { id: true, name: true } }
        }
      },
      ownerAssociation: {
        include: {
          contacts: { orderBy: { createdAt: "asc" } }
        }
      },
      operationalExpenses: {
        select: {
          id: true,
          description: true,
          amount: true,
          sourceType: true,
          recordedAt: true,
          recordedByUser: { select: { id: true, name: true } },
          pmAdvance: {
            select: {
              id: true,
              staff: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { recordedAt: "desc" }
      },
      expenses: {
        select: {
          id: true,
          description: true,
          amount: true,
          sourceType: true,
          date: true,
          recordedByUser: { select: { id: true, name: true } }
        },
        orderBy: { date: "desc" }
      },
      payments: {
        select: { id: true, amount: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      }
    }
  })

  if (!invoice) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Invoice not found",
        humanReadable: { ar: "لم أجد هذه الفاتورة. تأكد من الرقم وحاول مرة أخرى." },
        issues: { invoiceId: invoiceId ?? null, invoiceNumber: invoiceNumber ?? null }
      }
    }
  }

  const ownerContacts = invoice.ownerAssociation?.contacts ?? []
  const primaryPhone = ownerContacts.find((c: any) => c.type === "PHONE" && c.isPrimary)?.value ?? null
  const primaryEmail = ownerContacts.find((c: any) => c.type === "EMAIL" && c.isPrimary)?.value ?? null

  const allExpenses = [
    ...(invoice.operationalExpenses ?? []).map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      sourceType: e.sourceType,
      date: e.recordedAt,
      recordedBy: (e.recordedByUser as any)?.name ?? null,
      kind: "OPERATIONAL"
    })),
    ...(invoice.expenses ?? []).map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      sourceType: e.sourceType,
      date: (e as any).date ?? null,
      recordedBy: (e.recordedByUser as any)?.name ?? null,
      kind: "UNIT_EXPENSE"
    }))
  ].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0
    const bTime = b.date ? new Date(b.date).getTime() : 0
    return bTime - aTime
  })

  const totalExpenses = allExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  const humanReadable: HumanReadable = {
    ar: `فاتورة ${invoice.invoiceNumber} — الوحدة ${invoice.unit?.code ?? "غير محدد"} (${invoice.unit?.project?.name ?? ""})\nالمبلغ: ${formatCurrency(invoice.amount)} جنيه | المدفوع: ${formatCurrency(invoice.totalPaid)} جنيه | المتبقي: ${formatCurrency(invoice.remainingBalance)} جنيه\nالحالة: ${invoice.isPaid ? "✅ مدفوعة" : "⏳ غير مدفوعة"}\nعدد المصروفات: ${allExpenses.length} | عدد الدفعات: ${invoice.payments?.length ?? 0}`
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        amount: invoice.amount,
        totalPaid: invoice.totalPaid,
        remainingBalance: invoice.remainingBalance,
        isPaid: invoice.isPaid,
        issuedAt: invoice.issuedAt,
        dueDate: invoice.dueDate ?? null,
        unit: invoice.unit
          ? {
              id: invoice.unit.id,
              code: invoice.unit.code,
              name: invoice.unit.name,
              project: invoice.unit.project
            }
          : null,
        owner: {
          name: invoice.ownerAssociation?.name ?? null,
          phone: primaryPhone,
          email: primaryEmail
        },
        expenses: allExpenses,
        payments: (invoice.payments ?? []).map((p) => ({
          id: p.id,
          amount: p.amount,
          paidAt: p.createdAt
        })),
        totals: {
          expensesCount: allExpenses.length,
          totalExpenses: Number(totalExpenses.toFixed(2)),
          paymentsCount: invoice.payments?.length ?? 0
        }
      },
      humanReadable,
      suggestions: invoice.isPaid
        ? []
        : [
            {
              title: "دفع الفاتورة",
              prompt: `ادفع الفاتورة ${invoice.invoiceNumber}`,
              data: { invoiceId: invoice.id, remaining: invoice.remainingBalance }
            }
          ]
    }
  }
}

const HANDLERS: { [K in AllowedAction]: ActionHandler<K> } = {
  CREATE_PM_ADVANCE: handleCreatePmAdvance,
  CREATE_STAFF_ADVANCE: handleCreateStaffAdvance,
  UPDATE_STAFF_ADVANCE: handleUpdateStaffAdvance,
  DELETE_STAFF_ADVANCE: handleDeleteStaffAdvance,
  RECORD_ACCOUNTING_NOTE: handleRecordAccountingNote,
  PAY_INVOICE: handlePayInvoice,
  CREATE_PAYROLL: handleCreatePayroll,
  PAY_PAYROLL: handlePayPayroll,
  LIST_PAYROLLS: handleListPayrolls,
  LIST_UNIT_EXPENSES: handleListUnitExpenses,
  LIST_INVOICES: handleListInvoices,
  SEARCH_STAFF: handleSearchStaff,
  LIST_STAFF_ADVANCES: handleListStaffAdvances,
  SEARCH_ACCOUNTING_NOTES: handleSearchAccountingNotes,
  GET_INVOICE_DETAILS: handleGetInvoiceDetails as ActionHandler<"GET_INVOICE_DETAILS">
}

export async function POST(req: NextRequest) {
  const auth = await verifyN8nApiKey(req)

  if (!auth.valid) {
    const responseBody = {
      success: false,
      error: auth.error || "Unauthorized"
    }

    return NextResponse.json(responseBody, { status: 401 })
  }

  if (auth.context?.role !== "ACCOUNTANT" && auth.context?.role !== "ADMIN") {
    const responseBody = {
      success: false,
      error: "Forbidden"
    }

    await logWebhookEvent(
      auth.context?.keyId || "",
      "ACCOUNTANT_ACTION_FORBIDDEN",
      ENDPOINT,
      "POST",
      403,
      undefined,
      responseBody,
      "Forbidden accountant webhook access"
    )

    return NextResponse.json(responseBody, { status: 403 })
  }

  let parsed: RequestBody

  try {
    parsed = await req.json()
  } catch (error) {
    const responseBody = {
      success: false,
      error: "Invalid JSON payload"
    }

    await logWebhookEvent(
      auth.context.keyId,
      "ACCOUNTANT_ACTION_INVALID",
      ENDPOINT,
      "POST",
      400,
      undefined,
      responseBody,
      "Malformed JSON"
    )

    return NextResponse.json(responseBody, { status: 400 })
  }

  const { action, senderPhone, payload } = parsed

  if (!action || !senderPhone || typeof payload !== "object" || payload === null) {
    const responseBody = {
      success: false,
      error: "Missing required fields"
    }

    await logWebhookEvent(
      auth.context.keyId,
      "ACCOUNTANT_ACTION_INVALID",
      ENDPOINT,
      "POST",
      400,
      parsed,
      responseBody,
      "Missing action, senderPhone, or payload"
    )

    return NextResponse.json(responseBody, { status: 400 })
  }

  if (!ALLOWED_ACTIONS.includes(action as AllowedAction)) {
    const responseBody = {
      success: false,
      error: "Unsupported action"
    }

    await logWebhookEvent(
      auth.context.keyId,
      "ACCOUNTANT_ACTION_UNSUPPORTED",
      ENDPOINT,
      "POST",
      400,
      parsed,
      responseBody,
      `Unsupported action: ${action}`
    )

    return NextResponse.json(responseBody, { status: 400 })
  }

  const accountant = await resolveAccountant(senderPhone)

  if (!accountant) {
    const responseBody = {
      success: false,
      error: "Accountant not recognized",
      humanReadable: {
        ar: "رقم الواتساب غير مرتبط بحساب محاسب."
      }
    }

    await logWebhookEvent(
      auth.context.keyId,
      "ACCOUNTANT_ACTION_UNAUTHORIZED",
      ENDPOINT,
      "POST",
      404,
      parsed,
      responseBody,
      "Accountant phone not resolved"
    )

    return NextResponse.json(responseBody, { status: 404 })
  }

  const handler = HANDLERS[action as AllowedAction]

  let handlerResponse: HandlerResponse

  try {
    handlerResponse = await handler(accountant, payload as any)
  } catch (error) {
    console.error(`[ACCOUNTANT_WEBHOOK][${action}]`, error)

    handlerResponse = {
      status: 500,
      body: {
        success: false,
        error: "Internal server error",
        humanReadable: {
          ar: "حدث خطأ أثناء تنفيذ طلب المحاسب."
        }
      }
    }
  }

  const eventType = handlerResponse.body.success
    ? "ACCOUNTANT_ACTION_SUCCESS"
    : "ACCOUNTANT_ACTION_FAILED"

  await logWebhookEvent(
    auth.context.keyId,
    eventType,
    ENDPOINT,
    "POST",
    handlerResponse.status,
    parsed,
    handlerResponse.body,
    handlerResponse.body.success ? undefined : handlerResponse.body.error
  )

  return NextResponse.json(handlerResponse.body, { status: handlerResponse.status })
}
