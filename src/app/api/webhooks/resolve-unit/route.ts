import { NextRequest, NextResponse } from "next/server"
import { verifyN8nApiKey } from "@/lib/n8n-auth"
import { resolveUnit } from "@/lib/resolve-unit"
import { WEBHOOK_ALWAYS_OK } from "@/lib/webhook-response"

/**
 * POST /api/webhooks/resolve-unit
 *
 * يطابق ما قاله الساكن (اسم مشروع + اسم/رقم وحدة) ويُرجع نتيجة واحدة فقط.
 * لا يُرجع أبداً قائمة مشاريع أو وحدات — إما وحدة واحدة مطابقة أو رسالة خطأ.
 * يستخدمه البوت لتأكيد "تقصد كومباوند X - عمارة Y؟" قبل فتح التذكرة.
 *
 * Body: projectName?, unitName?, unitCode?, buildingNumber?
 */
export async function POST(req: NextRequest) {
  const auth = await verifyN8nApiKey(req)
  if (!auth.valid || !auth.context) {
    return NextResponse.json(
      { success: false, error: auth.error || "Unauthorized", humanReadable: { ar: "مفتاح غير صالح أو غير مصرح. تحقق من المفتاح." } },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
  if (auth.context.role !== "RESIDENT") {
    return NextResponse.json(
      { success: false, error: "Only resident context can resolve unit", humanReadable: { ar: "هذا الطلب للسكان فقط." } },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }

  const body = await req.json().catch(() => ({}))
  const result = await resolveUnit({
    projectName: body.projectName,
    unitName: body.unitName,
    unitCode: body.unitCode,
    buildingNumber: body.buildingNumber
  })
  return NextResponse.json(result.data, { status: WEBHOOK_ALWAYS_OK })
}
