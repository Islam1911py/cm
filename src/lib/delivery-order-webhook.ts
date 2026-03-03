import { db } from "@/lib/db"
import { logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"
import { notifyN8nEvent } from "@/lib/n8n-notify"

type AuthContext = { keyId: string | null; projectId?: string }

async function getPMsForProject(projectId: string) {
  const assignments = await db.projectAssignment.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, whatsappPhone: true, role: true } } }
  })
  return assignments
    .filter(a => a.user.role === "PROJECT_MANAGER" && a.user.whatsappPhone)
    .map(a => ({ name: a.user.name, phone: a.user.whatsappPhone! }))
}

/**
 * منطق إنشاء طلب التوصيل — يُستدعى inline من resident أو من POST /api/webhooks/delivery-orders.
 * المتصل يتحقق من المصادقة ودور RESIDENT قبل الاستدعاء.
 */
export async function createDeliveryOrderFromWebhook(
  body: Record<string, unknown>,
  authContext: AuthContext,
  ipAddress: string
): Promise<Record<string, unknown>> {
  const residentPhone = body.residentPhone as string | undefined
  const residentName = body.residentName as string | undefined
  const unitCode = body.unitCode as string | undefined
  const description = body.description as string | undefined
  const orderText = body.orderText as string | undefined
  const bodyProjectId = body.projectId as string | undefined

  const normalizedDescription = (description || orderText || "").trim()
  const normalizedUnitCode = typeof unitCode === "string" ? unitCode.trim() : ""
  const normalizedPhone = typeof residentPhone === "string" ? residentPhone.trim() : ""
  const projectId = bodyProjectId || authContext.projectId

  if (!normalizedPhone || !normalizedUnitCode || !normalizedDescription || !projectId) {
    await logWebhookEvent(
      authContext.keyId ?? "",
      "DELIVERY_ORDER_CREATED",
      "/api/webhooks/delivery-orders",
      "POST",
      400,
      body,
      { error: "Missing required fields" },
      "Missing required fields",
      ipAddress
    )
    return {
      success: false,
      error: "Missing required fields: residentPhone, unitCode, description, projectId",
      humanReadable: { ar: "مطلوب: residentPhone و unitCode و description و projectId. أرسلهم في الـ body." }
    }
  }

  const unit = await db.operationalUnit.findFirst({
    where: { code: normalizedUnitCode, projectId },
    include: { project: true }
  })

  if (!unit) {
    await logWebhookEvent(
      authContext.keyId ?? "",
      "DELIVERY_ORDER_CREATED",
      "/api/webhooks/delivery-orders",
      "POST",
      404,
      body,
      { error: "Unit not found" },
      `Unit ${normalizedUnitCode} not found`,
      ipAddress
    )
    return {
      success: false,
      error: "Unit not found for the given code and project",
      humanReadable: { ar: "الوحدة غير موجودة لهذا الكود والمشروع. تحقق من unitCode و projectId." }
    }
  }

  const phoneVariants = buildPhoneVariants(normalizedPhone)
  const resident = await db.resident.findFirst({
    where: {
      unitId: unit.id,
      OR: [{ phone: { in: phoneVariants } }, { whatsappPhone: { in: phoneVariants } }]
    }
  })

  const contactNameValue =
    resident?.name ?? (typeof residentName === "string" && residentName.trim() ? residentName.trim() : null)

  const order = await db.deliveryOrder.create({
    data: {
      title: normalizedDescription.substring(0, 100),
      description: normalizedDescription,
      status: "NEW",
      residentId: resident?.id ?? null,
      unitId: unit.id,
      contactPhone: resident ? null : normalizedPhone,
      contactName: resident ? null : contactNameValue
    },
    include: {
      resident: true,
      unit: { include: { project: true } }
    }
  })

  const requesterName = order.resident?.name ?? order.contactName ?? "ساكن (غير مسجّل)"
  const requesterPhone = order.resident?.phone ?? order.contactPhone ?? normalizedPhone

  await notifyN8nEvent("DELIVERY_ORDER_CREATED", {
    deliveryOrder: { id: order.id, title: order.title, description: order.description, status: order.status },
    resident: order.resident
      ? { id: order.resident.id, name: order.resident.name, phone: order.resident.phone, email: order.resident.email }
      : null,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    unit: {
      id: order.unit.id,
      code: order.unit.code,
      name: order.unit.name,
      project: order.unit.project?.name ?? null
    },
    requestedBy: residentName || null
  })

  const orderProjectId = order.unit.projectId
  if (orderProjectId) {
    const pms = await getPMsForProject(orderProjectId)
    if (pms.length > 0) {
      await notifyN8nEvent("PM_NEW_DELIVERY_ORDER", {
        pmPhones: pms,
        deliveryOrder: { id: order.id, title: order.title, description: order.description },
        resident: { name: requesterName, phone: requesterPhone ?? null },
        unit: { code: order.unit.code, name: order.unit.name ?? null, projectName: order.unit.project?.name ?? null },
        humanReadable: { ar: `طلب استلام/توصيل جديد من ${requesterName} في الوحدة ${order.unit.code} — ${order.title}` }
      })
    }
  }

  const response = {
    success: true,
    orderId: order.id,
    message: "Delivery order created successfully",
    deliveryOrder: order
  }

  await logWebhookEvent(
    authContext.keyId ?? "",
    "DELIVERY_ORDER_CREATED",
    "/api/webhooks/delivery-orders",
    "POST",
    201,
    body,
    response,
    undefined,
    ipAddress
  )

  return response
}
