import { NextRequest, NextResponse } from "next/server"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { createTicketFromWebhook } from "@/lib/ticket-create"
import { getTicketsFromWebhook } from "@/lib/tickets-query"
import { WEBHOOK_ALWAYS_OK } from "@/lib/webhook-response"

// GET /api/webhooks/tickets?residentPhone=+201234567890
export async function GET(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized", humanReadable: { ar: "مفتاح غير صالح أو غير مصرح." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    if (auth.context.role !== "RESIDENT") {
      return NextResponse.json(
        { success: false, error: "Only residents can query their tickets", humanReadable: { ar: "هذا الطلب للسكان فقط." } },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const { searchParams } = new URL(req.url)
    const residentPhone = searchParams.get("residentPhone") || searchParams.get("phone") || ""
    const ticketNumber = searchParams.get("ticketNumber") || searchParams.get("ticket_number") || searchParams.get("number") || null

    if (!residentPhone) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing residentPhone query parameter",
          humanReadable: { ar: "أرسل رقم واتساب الساكن في query parameter باسم residentPhone" }
        },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const data = await getTicketsFromWebhook({ residentPhone, ticketNumber }, auth.context, ipAddress)
    return NextResponse.json(data, { status: WEBHOOK_ALWAYS_OK })
  } catch (error) {
    console.error("Error fetching tickets:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch tickets", humanReadable: { ar: "حدث خطأ أثناء جلب التذاكر." } },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
}

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json()

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Unauthorized",
          humanReadable: {
            en: "API key failed verification, ticket webhook rejected.",
            ar: "مفتاح الـ API غير صالح، تم رفض تشغيل الويب هوك."
          },
          suggestions: [
            {
              title: "مراجعة بيانات API",
              prompt: "تأكد من استخدام مفتاح n8n الصحيح وتأكد أنه مفعّل في النظام."
            }
          ]
        },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    // Only RESIDENT role can create tickets
    if (auth.context.role !== "RESIDENT") {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_CREATED",
        "/api/webhooks/tickets",
        "POST",
        403,
        body,
        { error: "Insufficient permissions" },
        "Only residents can create tickets",
        ipAddress
      )

      return NextResponse.json(
        {
          success: false,
          error: "Only residents can create tickets",
          humanReadable: {
            en: "This webhook accepts resident credentials only.",
            ar: "هذا الويب هوك يقبل مفاتيح السكان فقط."
          },
          suggestions: [
            {
              title: "استخدم مفتاح الساكن",
              prompt: "أرسل الطلب بنفس مفتاح التكامل الخاص بالساكن الذي أنشأ التذكرة."
            }
          ]
        },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const result = await createTicketFromWebhook(body, auth.context, ipAddress)
    return NextResponse.json(result.data, { status: WEBHOOK_ALWAYS_OK })
  } catch (error) {
    console.error("Error creating ticket:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_CREATED",
        "/api/webhooks/tickets",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create ticket",
        humanReadable: {
          en: "Ticket creation failed due to an internal error.",
          ar: "فشل إنشاء التذكرة بسبب خطأ داخلي."
        },
        suggestions: [
          {
            title: "إعادة المحاولة لاحقاً",
            prompt: "حاول إعادة إرسال نفس الطلب بعد قليل أو تواصل مع فريق الدعم إذا استمرت المشكلة."
          }
        ]
      },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
}
