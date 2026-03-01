import { NextRequest, NextResponse } from "next/server"
import { verifyN8nApiKey } from "@/lib/n8n-auth"
import { resolveUnit } from "@/lib/resolve-unit"

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
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
  }
  if (auth.context.role !== "RESIDENT") {
    return NextResponse.json(
      { success: false, error: "Only resident context can resolve unit", humanReadable: { ar: "هذا الطلب للسكان فقط." } },
      { status: 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const result = await resolveUnit({
    projectName: body.projectName,
    unitName: body.unitName,
    unitCode: body.unitCode,
    buildingNumber: body.buildingNumber
  })
  return NextResponse.json(result.data, { status: result.status })
}
