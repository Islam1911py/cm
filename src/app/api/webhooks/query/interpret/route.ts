import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"

const TICKET_KEYWORDS = [
  "شكوى",
  "شكاوي",
  "شكايه",
  "تذكرة",
  "تذاكر",
  "بلاغ",
  "بلاغات",
  "مشكلة",
  "مشاكل",
  "اشتكى",
  "اشتكوا",
  "صيانة",
  "maintenance",
  "issue",
  "problem",
  "تسريب",
  "leak",
  "سباكة",
  "plumbing",
  "كهرباء",
  "electricity",
  "ticket",
  "complaint"
]

const EXPENSE_KEYWORDS = [
  "مصروف",
  "مصاريف",
  "صرف",
  "صرفنا",
  "expense",
  "electric",
  "كهرب",
  "فاتورة",
  "فواتير",
  "تكلفة",
  "ميزانية",
  "budget",
  "cost"
]

const ACCOUNTING_KEYWORDS = [
  "تحصيل",
  "دفعة",
  "دفعات",
  "invoice",
  "فواتير",
  "pending",
  "محاسبه",
  "مدفوعات",
  "balance",
  "رصيد",
  "متأخرات",
  "تحصيلات",
  "debt",
  "collections"
]

const PM_ADVANCE_KEYWORDS = [
  "عهدة",
  "عهد",
  "pm advance",
  "مقدم",
  "سلفة مدير",
  "pm money"
]

const STAFF_ADVANCE_KEYWORDS = [
  "سلفة",
  "سلف",
  "staff advance",
  "سلفه",
  "advance موظف",
  "موظف سلف"
]

const ACCOUNTING_NOTE_ACTION_KEYWORDS = [
  "حول القيد",
  "سجل القيد",
  "سجل الملاحظه",
  "convert note",
  "record note",
  "تحويل القيد",
  "اعتمد القيد",
  "ملاحظه محاسبيه"
]

const INVOICE_PAYMENT_KEYWORDS = [
  "سدد",
  "اسدد",
  "ادفع",
  "دفع",
  "تحصيل",
  "pay invoice",
  "invoice payment",
  "سداده",
  "سداد"
]

const PAYROLL_KEYWORDS = [
  "مرتب",
  "مرتبات",
  "رواتب",
  "كشف",
  "payroll",
  "salary sheet"
]

const CREATE_VERB_KEYWORDS = [
  "سجل",
  "create",
  "اعمل",
  "اضيف",
  "ضيف",
  "جهز",
  "prepare",
  "generate",
  "صرف",
  "اعتمد"
]

const UPDATE_VERB_KEYWORDS = [
  "عدل",
  "عدله",
  "عدلها",
  "update",
  "حدث",
  "تعديل",
  "غير",
  "زود",
  "قلل"
]

const DELETE_VERB_KEYWORDS = [
  "احذف",
  "احزف",
  "امسح",
  "ازاله",
  "شيل",
  "remove",
  "delete",
  "cancel",
  "الغ"
]

const PAY_VERB_KEYWORDS = [
  "ادفع",
  "سدد",
  "pay",
  "settle",
  "صرف",
  "صرفها",
  "صرفوا"
]

const STAFF_KEYWORDS = [
  "موظف",
  "موظفين",
  "staff",
  "عامل",
  "عمال",
  "فني",
  "فنيين",
  "technician",
  "team",
  "crew"
]

const RETRIEVE_VERB_KEYWORDS = [
  "هات",
  "هاتلي",
  "جيب",
  "جيبلي",
  "اعرض",
  "عرض",
  "عرضلي",
  "اظهر",
  "show",
  "list",
  "fetch",
  "report",
  "استعلام",
  "استعرض",
  "ابحث",
  "بحث",
  "دور",
  "دورلي",
  "شوف",
  "عايز اشوف",
  "عايز اعرف",
  "اعرف",
  "عرفني",
  "كم",
  "قد ايه",
  "قديه"
]

const STAFF_ADVANCE_STATUS_KEYWORDS: Record<"PENDING" | "DEDUCTED", string[]> = {
  PENDING: ["معلقه", "معلقة", "pending", "متبقي", "الباقي", "رصيد", "outstanding"],
  DEDUCTED: ["مخصوم", "مخصومة", "خصمت", "deducted", "مدفوع", "مسددة", "paid"]
}

const ACCOUNTING_NOTE_QUERY_KEYWORDS = [
  "قيد",
  "قيود",
  "قيد محاسبي",
  "محاسبية",
  "ملاحظه محاسبيه",
  "ملاحظات محاسبية",
  "ملاحظة محاسبية",
  "accounting note",
  "accounting notes",
  "note",
  "notes"
]

const ACCOUNTING_NOTE_STATUS_KEYWORDS: Record<"PENDING" | "CONVERTED" | "REJECTED", string[]> = {
  PENDING: ["معلقه", "معلقة", "pending", "منتظره", "منتظرة"],
  CONVERTED: ["محوله", "محولة", "converted", "recorded", "مسجلة"],
  REJECTED: ["مرفوض", "مرفوضة", "rejected", "رفض"]
}

const PROJECT_SUMMARY_KEYWORDS = [
  "ملخص",
  "وضع",
  "overview",
  "حالة",
  "status",
  "تفاصيل المشروع",
  "تفاصيل",
  "بيانات",
  "dashboard",
  "report",
  "إحصائيات",
  "احصائية",
  "اخبار"
]

const RESIDENT_KEYWORDS = [
  "ساكن",
  "سكان",
  "المقيم",
  "المقيمين",
  "residents",
  "resident",
  "ساكنين",
  "عدد السكان",
  "عدد الساكن",
  "قائمة السكان"
]

const RESIDENT_CONTACT_KEYWORDS = [
  "رقم",
  "رقمها",
  "رقمه",
  "رقمها",
  "تليفون",
  "تلفون",
  "تليفونه",
  "اتصال",
  "اتصل",
  "واتساب",
  "whatsapp",
  "contact",
  "phone"
]

const PARAM_DISPLAY_LABEL: Record<string, string> = {
  senderPhone: "رقم واتساب المدير",
  projectId: "معرف المشروع",
  unitCode: "كود الوحدة",
  residentName: "اسم الساكن",
  limit: "الحد الأقصى",
  statuses: "حالات التذاكر",
  query: "نص البحث",
  search: "كلمة البحث",
  fromDate: "تاريخ البداية",
  toDate: "تاريخ النهاية",
  status: "حالة الطلب"
}

const TICKET_TOPIC_KEYWORDS: Array<{ label: string; tokens: string[] }> = [
  {
    label: "السباكة",
    tokens: ["سباكة", "plumbing", "مواسير", "تسريب", "leak", "صرف صحي"]
  },
  {
    label: "الكهرباء",
    tokens: ["كهرب", "كهرباء", "electric", "electricity", "قاطع", "نور"]
  },
  {
    label: "المياه",
    tokens: ["مياه", "ماء", "water", "خزان", "ضعف المياه"]
  },
  {
    label: "النظافة",
    tokens: ["نظافة", "clean", "قمامة", "زبالة"]
  },
  {
    label: "الأمن",
    tokens: ["امن", "أمن", "security", "حراسة", "بوابة"]
  },
  {
    label: "الصيانة العامة",
    tokens: ["صيانة", "maintenance", "تصليح", "fix"]
  },
  {
    label: "المصاعد",
    tokens: ["مصعد", "اسنصير", "elevator", "lift"]
  }
]

const RANGE_KEYWORDS: Record<string, string[]> = {
  TODAY: ["اليوم", "النهارده", "انهارده", "today", "دلوقتي"],
  WEEK: ["اسبوع", "أسبوع", "7", "7 ايام", "سبعة"],
  MONTH: ["شهر", "30", "٣٠", "31", "٣١"],
  ALL: ["كل", "جميع", "على طول", "طول"],
}

const STATUS_KEYWORDS: Record<string, string[]> = {
  NEW: ["جديد", "جديدة", "فتح", "مفتوحة"],
  IN_PROGRESS: ["جار", "قيد", "شغال"],
  DONE: ["مقفل", "مغلق", "خلص", "انتهت", "closed", "منتهي"],
}

type Role = "ADMIN" | "ACCOUNTANT" | "PROJECT_MANAGER"

type StaffAdvanceStatus = "PENDING" | "DEDUCTED"

type AccountingNoteStatus = "PENDING" | "CONVERTED" | "REJECTED" | "ALL"

type Suggestion = {
  title: string
  prompt: string
  data?: Record<string, unknown>
}

type InterpretationCandidate = {
  id: string
  confidence: number
  role: Role
  description: string
  missingParameters: string[]
  searchTerms: string[]
  http: {
    method: "GET" | "POST"
    endpoint: string
    query?: Record<string, string | null>
    payload?: Record<string, unknown>
  }
  requiredParameters: string[]
  optionalParameters: string[]
  postProcess: string[]
  humanReadable: {
    en?: string
    ar?: string
  }
}

function normalize(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
}

function detectKeywords(question: string, keywords: string[]) {
  const normalizedQuestion = normalize(question)
  return keywords.filter((keyword) => normalizedQuestion.includes(normalize(keyword)))
}

function detectTicketTopics(question: string) {
  const normalizedQuestion = normalize(question)
  const topics = new Set<string>()

  for (const topic of TICKET_TOPIC_KEYWORDS) {
    if (topic.tokens.some((token) => normalizedQuestion.includes(normalize(token)))) {
      topics.add(topic.label)
    }
  }

  return Array.from(topics)
}

function detectRange(question: string) {
  const normalizedQuestion = normalize(question)
  for (const [range, tokens] of Object.entries(RANGE_KEYWORDS)) {
    if (tokens.some((token) => normalizedQuestion.includes(token))) {
      return range
    }
  }
  return null
}

function detectStatuses(question: string) {
  const normalizedQuestion = normalize(question)
  const statuses = new Set<"NEW" | "IN_PROGRESS" | "DONE">()
  for (const [status, tokens] of Object.entries(STATUS_KEYWORDS)) {
    if (tokens.some((token) => normalizedQuestion.includes(token))) {
      statuses.add(status as "NEW" | "IN_PROGRESS" | "DONE")
    }
  }
  return Array.from(statuses)
}

function detectLimit(question: string, fallback = 5) {
  const limitMatch = question.match(/(\d+)/)
  if (!limitMatch) {
    return fallback
  }
  const numeric = Number(limitMatch[1])
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback
  }
  return Math.min(Math.trunc(numeric), 25)
}

function detectUnitCode(question: string) {
  const unitRegex = /(?:كود\s+الوحدة|وحدة|شقة|unit|flat)\s+([A-Za-z0-9\-_/]+)/i
  const match = question.match(unitRegex)
  if (match && match[1]) {
    return match[1].trim()
  }
  return null
}

function detectMappedValues(question: string, mapping: Record<string, string[]>) {
  const normalizedQuestion = normalize(question)
  const values = new Set<string>()

  for (const [key, tokens] of Object.entries(mapping)) {
    if (tokens.some((token) => normalizedQuestion.includes(normalize(token)))) {
      values.add(key)
    }
  }

  return Array.from(values)
}

function extractExplicitLimit(question: string, max = 100) {
  const match = question.match(/(\d+)/)
  if (!match) {
    return null
  }

  const numeric = Number(match[1])
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.min(Math.trunc(numeric), max)
}

async function matchProject(question: string, explicitProjectName?: string | null) {
  const projectNameHint = explicitProjectName?.trim() ?? null
  const normalizedQuestion = normalize(question)
  const projects = await db.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  })

  for (const project of projects) {
    const normalizedProject = normalize(project.name)
    if (normalizedProject && normalizedQuestion.includes(normalizedProject)) {
      return { ...project, matchedBy: "question" as const }
    }
    if (projectNameHint && normalize(projectNameHint) === normalizedProject) {
      return { ...project, matchedBy: "hint" as const }
    }
  }

  if (projectNameHint) {
    const fallback = projects.find((project) => normalize(project.name) === normalize(projectNameHint))
    if (fallback) {
      return { ...fallback, matchedBy: "hint" as const }
    }
  }

  return null
}

function buildTicketCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  statuses: ("NEW" | "IN_PROGRESS" | "DONE")[]
  range: string | null
  limit: number
  question: string
  matchedKeywords: string[]
  topics: string[]
}): InterpretationCandidate {
  const requiredParameters: string[] = ["senderPhone"]
  const missingParameters: string[] = ["senderPhone"]
  const optionalParameters: string[] = ["statuses", "limit"]
  if (!options.projectId) {
    requiredParameters.push("projectId")
    missingParameters.push("projectId")
  }
  if (options.range) {
    optionalParameters.push("range")
  }

  const searchTerms = Array.from(new Set([...options.matchedKeywords, ...options.topics]))

  const payload: Record<string, unknown> = {
    action: "LIST_PROJECT_TICKETS",
    senderPhone: "{{pmPhone}}",
    payload: {
      projectId: options.projectId ?? "{{projectId}}",
      limit: options.limit,
      ...(options.statuses.length > 0 ? { statuses: options.statuses } : {}),
    }
  }

  return {
    id: "project-manager-list-tickets",
    confidence: Math.min(
      0.92,
      0.55 + (options.projectId ? 0.2 : 0) + options.matchedKeywords.length * 0.05 + options.topics.length * 0.03
    ),
    role: options.role,
    description: "قائمة التذاكر للمشروع المحدد مع دعم تحديد الحالة والعدد",
    missingParameters,
    searchTerms,
    http: {
      method: "POST",
      endpoint: "/api/webhooks/project-managers",
      payload
    },
    requiredParameters,
    optionalParameters,
    postProcess: [
      options.range
        ? `فلترة النتائج زمنيًا بحسب ${options.range}`
        : "ترتيب التذاكر تنازليًا حسب createdAt",
      "عرض رقم التذكرة والعنوان والحالة والساكن إن وجد",
      options.topics.length > 0
        ? `تركيز التحليل على التذاكر المتعلقة بـ ${options.topics.join(" و ")}`
        : "تحديد التذاكر الأكثر صلة بالوصف الوارد في السؤال"
    ],
    humanReadable: {
      ar: `استخدم إجراء LIST_PROJECT_TICKETS لاسترجاع أحدث التذاكر للمشروع${options.projectName ? ` ${options.projectName}` : ""}${
        options.topics.length > 0 ? ` مع التركيز على ${options.topics.join(" و ")}` : ""
      }.`
    }
  }
}

function buildExpenseCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  range: string | null
  question: string
  matchedKeywords: string[]
}) {
  const requiredParameters: string[] = []
  const optionalParameters: string[] = ["range", "unit", "date"]
  const missingParameters: string[] = []
  if (!options.projectId) {
    requiredParameters.push("projectId")
    missingParameters.push("projectId")
  }

  const query: Record<string, string | null> = {
    type: "LAST_EXPENSE",
    projectId: options.projectId ?? "{{projectId}}"
  }

  if (options.range && options.range !== "ALL") {
    query.range = options.range
  }

  const expenseKeywords = options.matchedKeywords.filter((keyword) => keyword.includes("كهرب"))
  const searchTerms = Array.from(new Set(options.matchedKeywords))

  return {
    id: "project-manager-last-expense",
    confidence: Math.min(0.85, 0.5 + (options.projectId ? 0.25 : 0) + (options.range ? 0.1 : 0)),
    role: options.role,
    description: "استعلام عن آخر المصروفات للمشروع مع إمكانية تصفية إضافية",
    missingParameters,
    searchTerms,
    http: {
      method: "GET",
      endpoint: "/api/webhooks/query",
      query
    },
    requiredParameters,
    optionalParameters,
    postProcess: [
      expenseKeywords.length > 0
        ? "تجميع النتائج التي تحتوي على كلمة كهربا/كهرباء في الوصف وحساب الإجمالي"
        : "تقديم ملخص لأهم المصروفات الحديثة مع الإجمالي المطلوب",
      "عرض الوحدة، الوصف، والقيمة لكل مصروف"
    ],
    humanReadable: {
      ar: `استخدم استعلام LAST_EXPENSE لسحب أحدث المصروفات للمشروع${options.projectName ? ` ${options.projectName}` : ""}. بعد استلام النتائج قم بتصفية البنود ذات الصلة بالسؤال ثم اعرض الإجمالي.`
    }
  } satisfies InterpretationCandidate
}

function buildAccountingCandidate(role: Role): InterpretationCandidate {
  return {
    id: "accountant-summary",
    confidence: 0.6,
    role,
    description: "لوحة المحاسب: فواتير، مدفوعات، ملاحظات معلقة",
    missingParameters: [],
    searchTerms: ["محاسبة", "فواتير", "مدفوعات"],
    http: {
      method: "GET",
      endpoint: "/api/webhooks/query",
      query: {
        type: "ACCOUNTING_DATA"
      }
    },
    requiredParameters: [],
    optionalParameters: [],
    postProcess: ["تلخيص التحصيلات والمبالغ المتبقية", "عرض الملاحظات المحاسبية المعلقة"],
    humanReadable: {
      ar: "استخدم type=ACCOUNTING_DATA للحصول على ملخص الفواتير والتحصيلات." }
  }
}

function buildAdminCandidate(role: Role): InterpretationCandidate {
  return {
    id: "admin-overview",
    confidence: 0.55,
    role,
    description: "ملخص شامل للمشروعات والوحدات والسكان والتذاكر",
    missingParameters: [],
    searchTerms: ["ملخص", "dashboard"],
    http: {
      method: "GET",
      endpoint: "/api/webhooks/query",
      query: {
        type: "ALL_DATA"
      }
    },
    requiredParameters: [],
    optionalParameters: [],
    postProcess: ["تحديد الأرقام المهمة للطلب الإداري", "استخراج أي عناصر تحتاج متابعة"],
    humanReadable: {
      ar: "استخدم type=ALL_DATA للحصول على نظرة عامة على المنصة ثم استخرج الجزء المطلوب من البيانات." }
  }
}

function buildProjectDataCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  question: string
  matchedKeywords: string[]
}): InterpretationCandidate {
  const requiredParameters: string[] = []
  const optionalParameters: string[] = ["senderPhone"]

  if (!options.projectId) {
    requiredParameters.push("projectId")
  }

  const missingParameters: string[] = []
  if (!options.projectId) {
    missingParameters.push("projectId")
  }

  return {
    id: "project-data-summary",
    confidence: Math.min(0.88, 0.55 + (options.projectId ? 0.25 : 0) + options.matchedKeywords.length * 0.05),
    role: options.role,
    description: "ملخص المشروع مع عدد الوحدات والسكان والتذاكر",
    missingParameters,
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "GET",
      endpoint: "/api/webhooks/query",
      query: {
        type: "PROJECT_DATA",
        projectId: options.projectId ?? "{{projectId}}"
      }
    },
    requiredParameters,
    optionalParameters,
    postProcess: [
      "اقرأ الحقل summary.totalResidents للإجابة عن عدد السكان",
      "استخدم المصفوفة residents لعرض الأسماء والوحدات عند الحاجة",
      "انقل المعلومات المطلوبة باللغة العربية مع ذكر اسم المشروع إن توفر"
    ],
    humanReadable: {
      ar: `استخدم استعلام PROJECT_DATA للحصول على عدد السكان والوحدات${options.projectName ? ` للمشروع ${options.projectName}` : ""}.`
    }
  }
}

function buildResidentPhoneCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  unitCode?: string | null
}): InterpretationCandidate {
  const requiredParameters: string[] = ["senderPhone", "projectId", "unitCode"]
  const missingParameters = requiredParameters.filter((param) => {
    if (param === "projectId") {
      return !options.projectId
    }
    if (param === "unitCode") {
      return !options.unitCode
    }
    return true
  })

  return {
    id: "project-manager-resident-phone",
    confidence: Math.min(0.88, 0.6 + (options.projectId ? 0.2 : 0)),
    role: options.role,
    description: "جلب رقم تواصل الساكن لوحدة محددة داخل المشروع",
    missingParameters,
    searchTerms: options.unitCode ? [options.unitCode] : [],
    http: {
      method: "POST",
      endpoint: "/api/webhooks/project-managers",
      payload: {
        action: "GET_RESIDENT_PHONE",
        senderPhone: "{{pmPhone}}",
        payload: {
          projectId: options.projectId ?? "{{projectId}}",
          unitCode: options.unitCode ?? "{{unitCode}}"
        }
      }
    },
    requiredParameters,
    optionalParameters: ["residentName", "limit"],
    postProcess: [
      "تحقق أن الاستجابة تحتوي على residents ثم اعرض الاسم والرقم",
      "أخبر المستخدم إذا تمت إعادة أكثر من ساكن واطلب تحديد الاسم عند الحاجة"
    ],
    humanReadable: {
      ar: `استخدم إجراء GET_RESIDENT_PHONE لاسترجاع رقم الساكن للوحدة المطلوبة${options.projectName ? ` داخل ${options.projectName}` : ""}.`
    }
  }
}

function buildAccountantListUnitExpensesCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  unitCode?: string | null
  searchTokens: string[]
  limit?: number | null
}): InterpretationCandidate {
  const payload: { action: string; senderPhone: string; payload: Record<string, unknown> } = {
    action: "LIST_UNIT_EXPENSES",
    senderPhone: "{{accountantPhone}}",
    payload: {
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.unitCode ? { unitCode: options.unitCode } : {}),
      ...(options.limit && options.limit > 0 ? { limit: Math.min(options.limit, 100) } : {})
    }
  }

  const searchTokens = Array.from(
    new Set([
      ...options.searchTokens,
      ...(options.unitCode ? [options.unitCode] : [])
    ])
  )

  const prioritizedSearch = options.searchTokens.find((token) => !["مصروف", "مصاريف", "صرف", "expense", "cost", "budget"].includes(token))
  if (prioritizedSearch) {
    payload.payload.search = prioritizedSearch
  }

  return {
    id: "accountant-list-unit-expenses",
    confidence: Math.min(
      0.9,
      0.62 + (options.projectId ? 0.08 : 0) + (options.unitCode ? 0.06 : 0) + Math.min(searchTokens.length * 0.04, 0.12)
    ),
    role: options.role,
    description: "قائمة مصروفات الوحدات مع فلاتر المصدر والتواريخ",
    missingParameters: [],
    searchTerms: searchTokens,
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload
    },
    requiredParameters: [],
    optionalParameters: ["projectId", "unitCode", "search", "sourceTypes", "fromDate", "toDate", "limit"],
    postProcess: [
      "استخدم meta.breakdownBySourceType لتحليل المصروفات حسب النوع",
      "تحقق من meta.dateFilter لتأكيد نطاق التواريخ",
      "اعرض تفاصيل كل مصروف مع الوحدة والمصدر والمبلغ"
    ],
    humanReadable: {
      ar: `استدعي LIST_UNIT_EXPENSES للحصول على مصروفات ${options.projectName ? options.projectName : "الوحدات"}${
        options.unitCode ? ` (الوحدة ${options.unitCode})` : ""
      } ثم حلل النتائج بالمجموع الإجمالي.`
    }
  }
}

function buildAccountantSearchStaffCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  matchedKeywords: string[]
  limit?: number | null
  onlyPending: boolean
}): InterpretationCandidate {
  const payload: { action: string; senderPhone: string; payload: Record<string, unknown> } = {
    action: "SEARCH_STAFF",
    senderPhone: "{{accountantPhone}}",
    payload: {
      query: "{{query}}",
      ...(options.projectId ? { projectId: options.projectId } : {})
    }
  }

  if (options.limit && options.limit > 0) {
    payload.payload.limit = Math.min(options.limit, 50)
  }

  if (options.onlyPending) {
    payload.payload.onlyWithPendingAdvances = true
  }

  const uniqueTerms = Array.from(new Set(options.matchedKeywords))

  return {
    id: "accountant-search-staff",
    confidence: Math.min(
      0.86,
      0.6 + options.matchedKeywords.length * 0.05 + (options.projectId ? 0.04 : 0) + (options.onlyPending ? 0.04 : 0)
    ),
    role: options.role,
    description: "البحث عن موظف بالاسم مع إبراز السلف المعلقة",
    missingParameters: ["query"],
    searchTerms: uniqueTerms,
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload
    },
    requiredParameters: ["query"],
    optionalParameters: ["projectId", "limit", "onlyWithPendingAdvances"],
    postProcess: [
      "راجع meta.staffSearch.matches لعرض أفضل النتائج بالدرجات",
      "استخدم meta.staffAdvances لتوضيح السلف المعلقة إن وجدت"
    ],
    humanReadable: {
      ar: `استدعي SEARCH_STAFF${options.projectName ? ` مع ربطه بالمشروع ${options.projectName}` : ""} ثم مرر اسم الموظف في query قبل التنفيذ.`
    }
  }
}

function buildAccountantListStaffAdvancesCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  matchedKeywords: string[]
  limit?: number | null
  status?: StaffAdvanceStatus
}): InterpretationCandidate {
  const payload: { action: string; senderPhone: string; payload: Record<string, unknown> } = {
    action: "LIST_STAFF_ADVANCES",
    senderPhone: "{{accountantPhone}}",
    payload: {
      ...(options.projectId ? { projectId: options.projectId } : {})
    }
  }

  if (options.limit && options.limit > 0) {
    payload.payload.limit = Math.min(options.limit, 200)
  }

  if (options.status) {
    payload.payload.status = options.status
  }

  const searchTerms = Array.from(
    new Set([
      ...options.matchedKeywords,
      ...(options.status ? [options.status] : [])
    ])
  )

  return {
    id: "accountant-list-staff-advances",
    confidence: Math.min(
      0.83,
      0.58 + options.matchedKeywords.length * 0.05 + (options.status ? 0.05 : 0) + (options.projectId ? 0.04 : 0)
    ),
    role: options.role,
    description: "قائمة بسلف الموظفين مع الإجمالي",
    missingParameters: [],
    searchTerms,
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload
    },
    requiredParameters: [],
    optionalParameters: ["query", "status", "projectId", "limit"],
    postProcess: [
      "اعرض totals من meta.totals بما يشمل count و amount",
      "حدد السلف المعلقة أو المخصومة بناءً على النتائج",
      "استخدم meta.staffSearch إن توفر لتأكيد الأسماء"
    ],
    humanReadable: {
      ar: `استخدم LIST_STAFF_ADVANCES لاسترجاع السلف${options.projectName ? ` داخل ${options.projectName}` : ""} ثم لخّص الإجمالي والحالات.`
    }
  }
}

function buildAccountantSearchAccountingNotesCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  unitCode?: string | null
  matchedKeywords: string[]
  limit?: number | null
  status?: AccountingNoteStatus
  includeConverted: boolean
}): InterpretationCandidate {
  const payload: { action: string; senderPhone: string; payload: Record<string, unknown> } = {
    action: "SEARCH_ACCOUNTING_NOTES",
    senderPhone: "{{accountantPhone}}",
    payload: {
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.unitCode ? { unitCode: options.unitCode } : {})
    }
  }

  if (options.limit && options.limit > 0) {
    payload.payload.limit = Math.min(options.limit, 150)
  }

  if (options.status) {
    payload.payload.status = options.status
  }

  if (options.includeConverted) {
    payload.payload.includeConverted = true
  }

  const searchTerms = Array.from(
    new Set([
      ...options.matchedKeywords,
      ...(options.unitCode ? [options.unitCode] : []),
      ...(options.status && options.status !== "ALL" ? [options.status] : [])
    ])
  )

  return {
    id: "accountant-search-accounting-notes",
    confidence: Math.min(
      0.85,
      0.58 + options.matchedKeywords.length * 0.05 + (options.status && options.status !== "ALL" ? 0.05 : 0) + (options.unitCode ? 0.04 : 0) + (options.includeConverted ? 0.02 : 0)
    ),
    role: options.role,
    description: "بحث في القيود المحاسبية مع التحكم في الحالة",
    missingParameters: [],
    searchTerms,
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload
    },
    requiredParameters: [],
    optionalParameters: ["query", "status", "projectId", "unitCode", "limit", "includeConverted"],
    postProcess: [
      "استخدم meta.totals.count و meta.totals.amount لعرض ملخص القيود",
      "استفد من meta.searchAnalysis.tokens لشرح معايير البحث المستخدمة",
      "اذكر القيود مع المشروع والوحدة وأي عهدة مرتبطة"
    ],
    humanReadable: {
      ar: `استدعي SEARCH_ACCOUNTING_NOTES${options.projectName ? ` مع المشروع ${options.projectName}` : ""} ثم طبّق المرشحات المطلوبة قبل الرد.`
    }
  }
}

function buildCreatePmAdvanceCandidate(options: {
  role: Role
  projectId?: string | null
  projectName?: string | null
  matchedKeywords: string[]
}): InterpretationCandidate {
  const payload: Record<string, unknown> = {
    action: "CREATE_PM_ADVANCE",
    senderPhone: "{{accountantPhone}}",
    payload: {
      staffId: "{{staffId}}",
      amount: "{{amount}}",
      ...(options.projectId ? { projectId: options.projectId } : {})
    }
  }

  if (!options.projectId) {
    ;(payload.payload as Record<string, unknown>).projectId = "{{projectId}}"
  }

  return {
    id: "accountant-create-pm-advance",
    confidence: Math.min(0.85, 0.6 + options.matchedKeywords.length * 0.05 + (options.projectId ? 0.1 : 0)),
    role: options.role,
    description: "تسجيل عهدة جديدة لمدير المشروع",
    missingParameters: ["staffId", "amount"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload
    },
    requiredParameters: ["staffId", "amount"],
    optionalParameters: ["projectId", "notes"],
    postProcess: [
      "تأكد من صحة staffId للموظف الذي يستلم العهدة",
      options.projectName
        ? `استخدم projectId الخاص بالمشروع ${options.projectName}`
        : "حدد projectId إذا كانت العهدة مرتبطة بمشروع معين",
      "يمكن إضافة notes توضح السبب أو الغرض في الحقل payload.notes"
    ],
    humanReadable: {
      ar: `استدعي إجراء CREATE_PM_ADVANCE لتسجيل العهدة${options.projectName ? ` على مشروع ${options.projectName}` : ""}.`
    }
  }
}

function buildCreateStaffAdvanceCandidate(options: {
  role: Role
  matchedKeywords: string[]
}): InterpretationCandidate {
  return {
    id: "accountant-create-staff-advance",
    confidence: Math.min(0.82, 0.58 + options.matchedKeywords.length * 0.05),
    role: options.role,
    description: "تسجيل سلفة جديدة لأحد الموظفين",
    missingParameters: ["staffId", "amount"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload: {
        action: "CREATE_STAFF_ADVANCE",
        senderPhone: "{{accountantPhone}}",
        payload: {
          staffId: "{{staffId}}",
          amount: "{{amount}}",
          note: "{{note}}"
        }
      }
    },
    requiredParameters: ["staffId", "amount"],
    optionalParameters: ["note"],
    postProcess: [
      "استخدم staffId للموظف المستفيد",
      "حدد amount كرقم موجب",
      "يمكن إضافة ملاحظة إضافية في الحقل note"
    ],
    humanReadable: {
      ar: "استدعي CREATE_STAFF_ADVANCE مع staffId والمبلغ لإضافة السلفة."
    }
  }
}

function buildUpdateStaffAdvanceCandidate(options: {
  role: Role
  matchedKeywords: string[]
}): InterpretationCandidate {
  return {
    id: "accountant-update-staff-advance",
    confidence: Math.min(0.8, 0.55 + options.matchedKeywords.length * 0.04),
    role: options.role,
    description: "تعديل بيانات سلفة موظف قائمة",
    missingParameters: ["advanceId"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload: {
        action: "UPDATE_STAFF_ADVANCE",
        senderPhone: "{{accountantPhone}}",
        payload: {
          advanceId: "{{advanceId}}",
          amount: "{{amount}}",
          note: "{{note}}"
        }
      }
    },
    requiredParameters: ["advanceId"],
    optionalParameters: ["amount", "note"],
    postProcess: [
      "تأكد من توفير advanceId الصحيح للسلفة",
      "حدث amount أو note أو كلاهما قبل الإرسال",
      "إذا لم يتغير أي حقل سيقوم النظام برفض الطلب"
    ],
    humanReadable: {
      ar: "استخدم UPDATE_STAFF_ADVANCE لتعديل السلفة، مع تزويد advanceId وإدخال القيم الجديدة في amount أو note."
    }
  }
}

function buildDeleteStaffAdvanceCandidate(options: {
  role: Role
  matchedKeywords: string[]
}): InterpretationCandidate {
  return {
    id: "accountant-delete-staff-advance",
    confidence: Math.min(0.78, 0.54 + options.matchedKeywords.length * 0.04),
    role: options.role,
    description: "حذف سلفة موظف طالما ما زالت معلقة",
    missingParameters: ["advanceId"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload: {
        action: "DELETE_STAFF_ADVANCE",
        senderPhone: "{{accountantPhone}}",
        payload: {
          advanceId: "{{advanceId}}"
        }
      }
    },
    requiredParameters: ["advanceId"],
    optionalParameters: [],
    postProcess: [
      "تأكد أن السلفة بحالة PENDING قبل الحذف",
      "أبلغ المستخدم إذا كانت السلفة مخصومة فلا يمكن حذفها"
    ],
    humanReadable: {
      ar: "استدعي DELETE_STAFF_ADVANCE مع advanceId المناسب لحذف السلفة المعلقة."
    }
  }
}

function buildRecordAccountingNoteCandidate(options: {
  role: Role
  matchedKeywords: string[]
}): InterpretationCandidate {
  return {
    id: "accountant-record-note",
    confidence: Math.min(0.83, 0.58 + options.matchedKeywords.length * 0.05),
    role: options.role,
    description: "تحويل القيد المحاسبي إلى مصروف وإصدار فاتورة مطالبة",
    missingParameters: ["noteId"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload: {
        action: "RECORD_ACCOUNTING_NOTE",
        senderPhone: "{{accountantPhone}}",
        payload: {
          noteId: "{{noteId}}",
          sourceType: "{{sourceType}}",
          pmAdvanceId: "{{pmAdvanceId}}"
        }
      }
    },
    requiredParameters: ["noteId"],
    optionalParameters: ["sourceType", "pmAdvanceId"],
    postProcess: [
      "أدخل noteId للقيد المراد تحويله",
      "إذا كان التمويل من عهدة مدير استخدم sourceType=PM_ADVANCE مع pmAdvanceId المناسب",
      "بعد التحويل اعرض رقم المطالبة الناتج للمستخدم"
    ],
    humanReadable: {
      ar: "استخدم RECORD_ACCOUNTING_NOTE لتحويل القيد إلى مصروف مع إمكانية ربطه بعهدة مدير."
    }
  }
}

function buildPayInvoiceCandidate(options: {
  role: Role
  matchedKeywords: string[]
}): InterpretationCandidate {
  return {
    id: "accountant-pay-invoice",
    confidence: Math.min(0.84, 0.6 + options.matchedKeywords.length * 0.05),
    role: options.role,
    description: "تسجيل دفعة على فاتورة مالك أو مطالبة",
    missingParameters: ["invoiceId"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload: {
        action: "PAY_INVOICE",
        senderPhone: "{{accountantPhone}}",
        payload: {
          invoiceId: "{{invoiceId}}",
          amount: "{{amount}}",
          action: "{{paymentAction}}"
        }
      }
    },
    requiredParameters: ["invoiceId"],
    optionalParameters: ["amount", "paymentAction"],
    postProcess: [
      "حدد invoiceId الصحيح",
      "إذا كانت الدفعة جزئية أرسل amount، وإلا استخدم paymentAction=mark-paid لتسوية الرصيد",
      "راجع الرصيد المتبقي بعد الدفع"
    ],
    humanReadable: {
      ar: "استدعي PAY_INVOICE مع invoiceId، ويمكن تمرير amount أو استخدام mark-paid لتسوية كاملة."
    }
  }
}

function buildCreatePayrollCandidate(options: {
  role: Role
  matchedKeywords: string[]
}): InterpretationCandidate {
  return {
    id: "accountant-create-payroll",
    confidence: Math.min(0.82, 0.57 + options.matchedKeywords.length * 0.05),
    role: options.role,
    description: "إنشاء كشف رواتب لشهر محدد",
    missingParameters: ["month"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload: {
        action: "CREATE_PAYROLL",
        senderPhone: "{{accountantPhone}}",
        payload: {
          month: "{{month}}"
        }
      }
    },
    requiredParameters: ["month"],
    optionalParameters: [],
    postProcess: [
      "استخدم month بصيغة YYYY-MM",
      "تحقق أنه لا يوجد كشف سابق لنفس الشهر قبل التنفيذ"
    ],
    humanReadable: {
      ar: "استدعي CREATE_PAYROLL مع month بصيغة YYYY-MM لإنشاء كشف الرواتب."
    }
  }
}

function buildPayPayrollCandidate(options: {
  role: Role
  matchedKeywords: string[]
}): InterpretationCandidate {
  return {
    id: "accountant-pay-payroll",
    confidence: Math.min(0.83, 0.58 + options.matchedKeywords.length * 0.05),
    role: options.role,
    description: "تأكيد صرف كشف الرواتب وخصم السلف المعلقة",
    missingParameters: ["payrollId"],
    searchTerms: Array.from(new Set(options.matchedKeywords)),
    http: {
      method: "POST",
      endpoint: "/api/webhooks/accountants",
      payload: {
        action: "PAY_PAYROLL",
        senderPhone: "{{accountantPhone}}",
        payload: {
          payrollId: "{{payrollId}}"
        }
      }
    },
    requiredParameters: ["payrollId"],
    optionalParameters: [],
    postProcess: [
      "تأكد أن الكشف بحالة PENDING قبل الدفع",
      "راجع السلف المعلقة المرتبطة ليتم خصمها تلقائياً"
    ],
    humanReadable: {
      ar: "استدعي PAY_PAYROLL مع payrollId لتأكيد صرف الرواتب وخصم السلف."
    }
  }
}

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json()
    const auth = await verifyN8nApiKey(req)

    if (!auth.valid || !auth.context) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
    }

    const question = String(body?.question ?? "").trim()
    const explicitProjectName = body?.projectName ? String(body.projectName) : undefined
    const preferredRole = body?.role as Role | undefined

    if (question.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "question is required",
          humanReadable: {
            en: "Provide a natural-language question to interpret.",
            ar: "من فضلك أرسل السؤال الطبيعي المطلوب تحويله." }
        },
        { status: 400 }
      )
    }

    const role: Role = preferredRole ?? (auth.context.role as Role) ?? "PROJECT_MANAGER"
    const normalizedQuestion = question.toLowerCase()

    const matchedTickets = detectKeywords(normalizedQuestion, TICKET_KEYWORDS)
    const matchedExpenses = detectKeywords(normalizedQuestion, EXPENSE_KEYWORDS)
    const matchedAccounting = detectKeywords(normalizedQuestion, ACCOUNTING_KEYWORDS)
    const matchedSummary = detectKeywords(normalizedQuestion, PROJECT_SUMMARY_KEYWORDS)
    const matchedResidents = detectKeywords(normalizedQuestion, RESIDENT_KEYWORDS)
    const matchedResidentContact = detectKeywords(normalizedQuestion, RESIDENT_CONTACT_KEYWORDS)
    const matchedPmAdvance = detectKeywords(normalizedQuestion, PM_ADVANCE_KEYWORDS)
    const matchedStaffAdvance = detectKeywords(normalizedQuestion, STAFF_ADVANCE_KEYWORDS)
    const matchedAccountingNoteActions = detectKeywords(normalizedQuestion, ACCOUNTING_NOTE_ACTION_KEYWORDS)
    const matchedInvoicePayment = detectKeywords(normalizedQuestion, INVOICE_PAYMENT_KEYWORDS)
    const matchedPayroll = detectKeywords(normalizedQuestion, PAYROLL_KEYWORDS)
    const matchedCreateVerbs = detectKeywords(normalizedQuestion, CREATE_VERB_KEYWORDS)
    const matchedUpdateVerbs = detectKeywords(normalizedQuestion, UPDATE_VERB_KEYWORDS)
    const matchedDeleteVerbs = detectKeywords(normalizedQuestion, DELETE_VERB_KEYWORDS)
    const matchedPayVerbs = detectKeywords(normalizedQuestion, PAY_VERB_KEYWORDS)
    const matchedRetrieveVerbs = detectKeywords(normalizedQuestion, RETRIEVE_VERB_KEYWORDS)
    const matchedStaff = detectKeywords(normalizedQuestion, STAFF_KEYWORDS)
    const staffAdvanceStatusHints = detectMappedValues(question, STAFF_ADVANCE_STATUS_KEYWORDS)
    const matchedAccountingNoteQueries = detectKeywords(normalizedQuestion, ACCOUNTING_NOTE_QUERY_KEYWORDS)
    const accountingNoteStatusHints = detectMappedValues(question, ACCOUNTING_NOTE_STATUS_KEYWORDS)
    const mentionsUnit =
      normalizedQuestion.includes("وحدة") ||
      normalizedQuestion.includes("شقة") ||
      normalizedQuestion.includes("unit") ||
      normalizedQuestion.includes("flat")

    const range = detectRange(normalizedQuestion)
    const statuses = detectStatuses(normalizedQuestion)
    const limit = detectLimit(normalizedQuestion)
    const unitCode = detectUnitCode(question)

    const projectMatch = await matchProject(question, explicitProjectName)
    const ticketTopics = detectTicketTopics(question)

    const candidates: InterpretationCandidate[] = []

    if (matchedTickets.length > 0 || normalizedQuestion.includes("ticket")) {
      candidates.push(
        buildTicketCandidate({
          role,
          projectId: projectMatch?.id ?? null,
          projectName: projectMatch?.name ?? null,
          statuses,
          range,
          limit,
          question,
          matchedKeywords: matchedTickets,
          topics: ticketTopics
        })
      )
    }

    if (matchedExpenses.length > 0) {
      candidates.push(
        buildExpenseCandidate({
          role,
          projectId: projectMatch?.id ?? null,
          projectName: projectMatch?.name ?? null,
          range,
          question,
          matchedKeywords: matchedExpenses
        })
      )
    }

    if (role === "ACCOUNTANT") {
      if (
        matchedExpenses.length > 0 &&
        (
          matchedRetrieveVerbs.length > 0 ||
          (!matchedCreateVerbs.length && (mentionsUnit || matchedExpenses.some((keyword) => keyword !== "مصروف" && keyword !== "مصاريف" && keyword !== "expense" && keyword !== "cost")))
        )
      ) {
        const expenseLimit = extractExplicitLimit(question, 100)
        candidates.push(
          buildAccountantListUnitExpensesCandidate({
            role,
            projectId: projectMatch?.id ?? null,
            projectName: projectMatch?.name ?? null,
            unitCode,
            searchTokens: matchedExpenses,
            limit: expenseLimit
          })
        )
      }

      if (matchedStaff.length > 0 && matchedRetrieveVerbs.length > 0) {
        const staffSearchLimit = extractExplicitLimit(question, 50)
        const pendingOnly = staffAdvanceStatusHints.includes("PENDING")
        candidates.push(
          buildAccountantSearchStaffCandidate({
            role,
            projectId: projectMatch?.id ?? null,
            projectName: projectMatch?.name ?? null,
            matchedKeywords: matchedStaff.concat(matchedRetrieveVerbs),
            limit: staffSearchLimit,
            onlyPending: pendingOnly
          })
        )
      }

      const staffAdvanceStatusHint = staffAdvanceStatusHints.find(
        (status): status is StaffAdvanceStatus => status === "PENDING" || status === "DEDUCTED"
      )

      if (matchedPmAdvance.length > 0) {
        candidates.push(
          buildCreatePmAdvanceCandidate({
            role,
            projectId: projectMatch?.id ?? null,
            projectName: projectMatch?.name ?? null,
            matchedKeywords: matchedPmAdvance
          })
        )
      }

      if (matchedStaffAdvance.length > 0) {
        if (matchedDeleteVerbs.length > 0) {
          candidates.push(
            buildDeleteStaffAdvanceCandidate({
              role,
              matchedKeywords: matchedStaffAdvance.concat(matchedDeleteVerbs)
            })
          )
        } else if (matchedUpdateVerbs.length > 0) {
          candidates.push(
            buildUpdateStaffAdvanceCandidate({
              role,
              matchedKeywords: matchedStaffAdvance.concat(matchedUpdateVerbs)
            })
          )
        } else if (matchedRetrieveVerbs.length > 0 || staffAdvanceStatusHint) {
          const advancesLimit = extractExplicitLimit(question, 200)
          candidates.push(
            buildAccountantListStaffAdvancesCandidate({
              role,
              projectId: projectMatch?.id ?? null,
              projectName: projectMatch?.name ?? null,
              matchedKeywords: matchedStaffAdvance.concat(matchedRetrieveVerbs, staffAdvanceStatusHints),
              limit: advancesLimit,
              status: staffAdvanceStatusHint
            })
          )
        } else {
          candidates.push(
            buildCreateStaffAdvanceCandidate({
              role,
              matchedKeywords: matchedStaffAdvance
            })
          )
        }
      }

      if (matchedAccountingNoteActions.length > 0) {
        candidates.push(
          buildRecordAccountingNoteCandidate({
            role,
            matchedKeywords: matchedAccountingNoteActions
          })
        )
      }

      if (
        matchedAccountingNoteQueries.length > 0 &&
        (matchedRetrieveVerbs.length > 0 || matchedAccountingNoteActions.length === 0)
      ) {
        const noteStatuses = accountingNoteStatusHints
        let resolvedStatus: AccountingNoteStatus | undefined

        if (noteStatuses.length === 1) {
          resolvedStatus = noteStatuses[0] as AccountingNoteStatus
        } else if (noteStatuses.length > 1) {
          resolvedStatus = "ALL"
        }

        const includeConverted = noteStatuses.includes("CONVERTED")
        const notesLimit = extractExplicitLimit(question, 150)

        candidates.push(
          buildAccountantSearchAccountingNotesCandidate({
            role,
            projectId: projectMatch?.id ?? null,
            projectName: projectMatch?.name ?? null,
            unitCode,
            matchedKeywords: matchedAccountingNoteQueries.concat(matchedRetrieveVerbs, noteStatuses),
            limit: notesLimit,
            status: resolvedStatus,
            includeConverted
          })
        )
      }

      if (
        matchedInvoicePayment.length > 0 ||
        (matchedAccounting.some((kw) => kw.includes("invoice") || kw.includes("فاتور")) && matchedPayVerbs.length > 0)
      ) {
        candidates.push(
          buildPayInvoiceCandidate({
            role,
            matchedKeywords: Array.from(new Set([...matchedAccounting, ...matchedInvoicePayment, ...matchedPayVerbs]))
          })
        )
      }

      if (matchedPayroll.length > 0) {
        if (matchedPayVerbs.length > 0) {
          candidates.push(
            buildPayPayrollCandidate({
              role,
              matchedKeywords: matchedPayroll.concat(matchedPayVerbs)
            })
          )
        } else {
          candidates.push(
            buildCreatePayrollCandidate({
              role,
              matchedKeywords: matchedPayroll.concat(matchedCreateVerbs)
            })
          )
        }
      }
    }

    if (role === "ACCOUNTANT" || matchedAccounting.length > 0) {
      candidates.push(buildAccountingCandidate(role))
    }

    if (role === "ADMIN" || matchedSummary.length > 0) {
      candidates.push(buildAdminCandidate(role))
    }

    if (matchedResidents.length > 0 || normalizedQuestion.includes("resident")) {
      candidates.push(
        buildProjectDataCandidate({
          role,
          projectId: projectMatch?.id ?? null,
          projectName: projectMatch?.name ?? null,
          question,
          matchedKeywords: matchedResidents
        })
      )
    }

    if (matchedResidentContact.length > 0 && (matchedResidents.length > 0 || mentionsUnit)) {
      candidates.push(
        buildResidentPhoneCandidate({
          role,
          projectId: projectMatch?.id ?? null,
          projectName: projectMatch?.name ?? null,
          unitCode
        })
      )
    }

    const sortedCandidates = candidates.sort((a, b) => b.confidence - a.confidence)

    const success = sortedCandidates.length > 0

    const suggestions: Suggestion[] = success
      ? []
      : [
          {
            title: "تحديد نوع البيانات",
            prompt: "هل السؤال متعلق بالمصروفات، التذاكر، أو ملخص إداري؟"
          }
        ]

    if (success) {
      const topCandidate = sortedCandidates[0]
      if (topCandidate.missingParameters.length > 0) {
        const missingLabels = topCandidate.missingParameters.map(
          (param) => PARAM_DISPLAY_LABEL[param] ?? param
        )
        suggestions.push({
          title: "تجهيز البيانات المطلوبة",
          prompt: `أرسل ${missingLabels.join(" و ")} لإكمال الطلب الحالي.`,
          data: {
            missingParameters: topCandidate.missingParameters
          }
        })
      }
    }

    const humanReadable = success
      ? {
          ar: `تم تحليل السؤال وتقديم ${sortedCandidates.length} اختيار(ات) لاستعلامات مناسبة${projectMatch ? ` بناءً على المشروع ${projectMatch.name}` : ""}.`
        }
      : {
          ar: "لم يتم التعرف على نوع السؤال. فضلاً وضّح إذا كان يتعلق بتذاكر، مصروفات، أو ملخص مشروع."
        }

    const responseBody = {
      success,
      question,
      role,
      projectMatch,
      range: range ?? null,
      statuses,
      limit,
      candidates: sortedCandidates,
      humanReadable,
      suggestions
    }

    await logWebhookEvent(
      auth.context.keyId,
      "QUERY_INTERPRETED",
      "/api/webhooks/query/interpret",
      "POST",
      success ? 200 : 422,
      body,
      responseBody,
      success ? undefined : "Unrecognized question",
      ipAddress
    )

    return NextResponse.json(responseBody, { status: success ? 200 : 422 })
  } catch (error) {
    console.error("Interpretation error:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "QUERY_INTERPRETED",
        "/api/webhooks/query/interpret",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        req.headers.get("x-forwarded-for") || "unknown"
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to interpret question"
      },
      { status: 500 }
    )
  }
}
