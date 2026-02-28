import { NextRequest, NextResponse } from "next/server"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { identifyContactByPhone } from "@/lib/identity-by-phone"

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const inputRaw = body?.phone ?? body?.senderPhone ?? body?.contact ?? body?.query
    const input = typeof inputRaw === "string" ? inputRaw.trim() : ""

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: "phone is required",
          humanReadable: {
            ar: "أرسل رقم الهاتف المطلوب التعرف عليه."
          }
        },
        { status: 400 }
      )
    }

    const responseBody = await identifyContactByPhone(input)

    await logWebhookEvent(
      auth.context.keyId,
      "CONTACT_IDENTIFIED",
      "/api/webhooks/identity",
      "POST",
      200,
      body,
      responseBody,
      responseBody.contact.role === "UNREGISTERED" ? "Unregistered number" : undefined,
      ipAddress
    )

    return NextResponse.json(responseBody, { status: 200 })
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
      {
        success: false,
        error: "Failed to identify contact"
      },
      { status: 500 }
    )
  }
}
