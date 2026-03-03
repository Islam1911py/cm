import { NextRequest, NextResponse } from "next/server"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { runIdentityLogic } from "@/lib/identity-webhook"
import { WEBHOOK_ALWAYS_OK } from "@/lib/webhook-response"

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized", humanReadable: { ar: "مفتاح الـ API غير صالح أو غير مصرح. تحقق من المفتاح." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const body = await req.json().catch(() => null)
    const inputRaw = body?.phone ?? body?.senderPhone ?? body?.contact ?? body?.query
    const input = typeof inputRaw === "string" ? inputRaw.trim() : ""

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: "phone is required",
          humanReadable: { ar: "أرسل رقم الهاتف المطلوب التعرف عليه (phone أو senderPhone أو contact أو query)." }
        },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const responseBody = await runIdentityLogic(input, auth.context, ipAddress, body ?? undefined)

    return NextResponse.json(responseBody, { status: WEBHOOK_ALWAYS_OK })
  } catch (error) {
    console.error("CONTACT_IDENTIFY_ERROR", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "CONTACT_IDENTIFIED",
        "/api/webhooks/identity",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to identify contact", humanReadable: { ar: "حدث خطأ أثناء التعرف على الرقم. جرّب مرة أخرى." } },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
}
