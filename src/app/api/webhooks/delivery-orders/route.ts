import { NextRequest, NextResponse } from "next/server"

import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { createDeliveryOrderFromWebhook } from "@/lib/delivery-order-webhook"
import { WEBHOOK_ALWAYS_OK } from "@/lib/webhook-response"

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json().catch(() => ({}))
    const auth = await verifyN8nApiKey(req)

    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized", humanReadable: { ar: "مفتاح غير صالح أو غير مصرح. تحقق من المفتاح." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    if (auth.context.role !== "RESIDENT") {
      await logWebhookEvent(
        auth.context.keyId,
        "DELIVERY_ORDER_CREATED",
        "/api/webhooks/delivery-orders",
        "POST",
        403,
        body,
        { error: "Only residents can request delivery orders" },
        "Only residents can request delivery orders",
        ipAddress
      )
      return NextResponse.json(
        { success: false, error: "Only residents can request delivery orders", humanReadable: { ar: "هذا الطلب للسكان فقط. استخدم مفتاح ساكن." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const data = await createDeliveryOrderFromWebhook(body, auth.context, ipAddress)
    return NextResponse.json(data, { status: WEBHOOK_ALWAYS_OK })
  } catch (error) {
    console.error("Error creating delivery order:", error)
    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "DELIVERY_ORDER_CREATED",
        "/api/webhooks/delivery-orders",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to create delivery order", humanReadable: { ar: "حدث خطأ أثناء إنشاء طلب التوصيل. جرّب مرة أخرى." } },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
}
