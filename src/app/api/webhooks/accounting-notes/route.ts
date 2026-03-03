import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"
import { WEBHOOK_ALWAYS_OK } from "@/lib/webhook-response"

function buildWhatsappMessage(options: {
  projectName: string
  unitCode: string
  unitName?: string | null
  amount: number
  description: string
  createdBy: string
  noteId: string
  createdAt: Date
}) {
  const amountText = new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2
  }).format(options.amount)

  const createdAt = new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(options.createdAt)

  const unitLabel = options.unitName
    ? `${options.unitCode} - ${options.unitName}`
    : options.unitCode

  return [
    "📌 ملاحظة محاسبية جديدة",
    `رقم الملاحظة: ${options.noteId}`,
    `التاريخ: ${createdAt}`,
    `المشروع: ${options.projectName}`,
    `الوحدة: ${unitLabel}`,
    `القيمة: ${amountText}`,
    "",
    "التفاصيل:",
    options.description,
    "",
    `أُنشئت بواسطة: ${options.createdBy}`
  ]
    .join("\n")
    .trim()
}

// POST /api/webhooks/accounting-notes - من PM لإضافة ملاحظات محاسبية
export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json()

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized", humanReadable: { ar: "مفتاح غير صالح أو غير مصرح. تحقق من المفتاح." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const context = auth.context

    // Only PROJECT_MANAGER or ADMIN يمكن create accounting notes
    if (
      context.role !== "PROJECT_MANAGER" &&
      context.role !== "ADMIN"
    ) {
      await logWebhookEvent(
        context.keyId,
        "ACCOUNTING_NOTE_CREATED",
        "/api/webhooks/accounting-notes",
        "POST",
        403,
        body,
        { error: "Insufficient permissions" },
        "Only PROJECT_MANAGER or ADMIN can create notes",
        ipAddress
      )

      return NextResponse.json(
        { success: false, error: "Insufficient permissions", humanReadable: { ar: "هذا الطلب لمدير المشروع أو الأدمن فقط." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // Validate required fields
    const { unitId, description, amount, reason, notes, createdByUserId, pmPhone } = body

    if (!unitId || !description || amount === undefined || amount === null) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: unitId, description, amount", humanReadable: { ar: "مطلوب: unitId و description و amount في الـ body." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const parsedAmount = Number(amount)
    if (Number.isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number", humanReadable: { ar: "المبلغ يجب أن يكون رقماً موجباً." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // Find unit
    const unit = await db.operationalUnit.findUnique({
      where: { id: unitId },
      include: {
        project: true
      }
    })

    if (!unit) {
      return NextResponse.json(
        { success: false, error: "Unit not found", humanReadable: { ar: "الوحدة غير موجودة. تحقق من unitId." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // If the API key is scoped to a project, enforce it matches the unit
    if (context.projectId && context.projectId !== unit.projectId) {
      return NextResponse.json(
        { success: false, error: "This API key is not allowed to access this project", humanReadable: { ar: "مفتاح الـ API غير مسموح له بهذا المشروع." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // Locate the user who will be marked as the creator
    const normalizedDescription = [
      description,
      reason ? `سبب إضافي:\n${reason}` : null,
      notes ? `ملاحظات إضافية:\n${notes}` : null
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim()

    const phoneVariants = pmPhone ? buildPhoneVariants(pmPhone) : []

    const orConditions: any[] = []
    if (createdByUserId) {
      orConditions.push({ id: createdByUserId })
    }
    if (pmPhone && phoneVariants.length > 0) {
      orConditions.push({
        AND: [
          { role: "PROJECT_MANAGER" },
          {
            OR: [
              { whatsappPhone: { in: phoneVariants } },
              { email: { in: phoneVariants } }
            ]
          }
        ]
      })
    }
    if (context.role === "PROJECT_MANAGER") {
      orConditions.push({
        AND: [
          { role: "PROJECT_MANAGER" },
          {
            OR: [
              { canViewAllProjects: true },
              { assignedProjects: { some: { projectId: unit.projectId } } }
            ]
          }
        ]
      })
    }
    if (context.role === "ADMIN") {
      orConditions.push({ role: "ADMIN" })
    }
    if (orConditions.length === 0) {
      orConditions.push({ role: { in: ["ADMIN", "PROJECT_MANAGER"] } })
    }

    const creatorCandidates = await db.user.findMany({
      where: { OR: orConditions },
      include: {
        assignedProjects: true
      },
      orderBy: { createdAt: "asc" }
    })

    const authRole = context.role

    const creatorUser = creatorCandidates.find(user =>
      authRole === "PROJECT_MANAGER"
        ? user.role === "PROJECT_MANAGER"
        : true
    ) || creatorCandidates[0]

    if (!creatorUser) {
      return NextResponse.json(
        { success: false, error: "No eligible user found to own this note", humanReadable: { ar: "لم يُعثر على مستخدم مؤهل لإنشاء الملاحظة. تحقق من pmPhone أو createdByUserId." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    if (
      creatorUser.role === "PROJECT_MANAGER" &&
      !creatorUser.canViewAllProjects &&
      !creatorUser.assignedProjects.some(ap => ap.projectId === unit.projectId)
    ) {
      return NextResponse.json(
        { success: false, error: "Project Manager is not assigned to this project", humanReadable: { ar: "مدير المشروع غير معيّن لهذا المشروع." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // Create accounting note
    const accountingNote = await db.accountingNote.create({
      data: {
        projectId: unit.projectId,
        unitId: unit.id,
        createdByUserId: creatorUser.id,
        description: normalizedDescription,
        amount: parsedAmount,
        status: "PENDING"
      },
      include: {
        unit: {
          include: { project: true }
        },
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const response = {
      success: true,
      noteId: accountingNote.id,
      unit: {
        id: accountingNote.unit.id,
        code: accountingNote.unit.code,
        name: accountingNote.unit.name,
        project: accountingNote.unit.project.name
      },
      description: accountingNote.description,
      amount: accountingNote.amount,
      reason,
      notes,
      status: accountingNote.status,
      createdBy: accountingNote.createdByUser.name,
        createdAt: accountingNote.createdAt,
        message: "Accounting note created successfully",
        whatsappMessage: buildWhatsappMessage({
          projectName: accountingNote.unit.project.name,
          unitCode: accountingNote.unit.code,
          unitName: accountingNote.unit.name,
          amount: accountingNote.amount,
          description: accountingNote.description,
          createdBy: accountingNote.createdByUser.name,
          noteId: accountingNote.id,
          createdAt: accountingNote.createdAt
        })
    }

    await logWebhookEvent(
      auth.context.keyId,
      "ACCOUNTING_NOTE_CREATED",
      "/api/webhooks/accounting-notes",
      "POST",
      201,
      body,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response, { status: WEBHOOK_ALWAYS_OK })
  } catch (error) {
    console.error("Error creating accounting note:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "ACCOUNTING_NOTE_CREATED",
        "/api/webhooks/accounting-notes",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to create accounting note", humanReadable: { ar: "حدث خطأ أثناء إنشاء الملاحظة المحاسبية. جرّب مرة أخرى." } },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
}
