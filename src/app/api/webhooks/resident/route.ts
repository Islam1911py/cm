import { NextRequest, NextResponse } from "next/server"
import { verifyN8nApiKey } from "@/lib/n8n-auth"
import { resolveUnit } from "@/lib/resolve-unit"
import { createTicketFromWebhook } from "@/lib/ticket-create"
import { createDeliveryOrderFromWebhook } from "@/lib/delivery-order-webhook"
import { runIdentityLogic } from "@/lib/identity-webhook"
import { getTicketsFromWebhook } from "@/lib/tickets-query"
import { WEBHOOK_ALWAYS_OK, botFail } from "@/lib/webhook-response"

/**
 * أداة موحّدة لعمليات الساكن والهوية.
 * GET  → برومبت + تعريف الـ actions ومتى تستخدم كل واحدة والـ payload.
 * POST → تنفيذ action معيّن حسب الـ payload.
 */

const RESIDENT_TOOL_PROMPT = `استخدم هذا الـ webhook حسب نية المستخدم:

1) IDENTITY — عندما تريد معرفة "مين صاحب الرقم؟" (أدمن، محاسب، مدير مشروع، ساكن، أو رقم غير مسجل).
   استخدمه عند أول رسالة أو عند الحاجة لتوجيه المحادثة حسب نوع المتصل.

2) TICKET_CREATE — عندما يريد المستخدم "تسجيل شكوى" أو "فتح تذكرة" أو "بلغ عن مشكلة".
   يحتاج: وصف المشكلة + كود/رقم الوحدة (واختياري: اسمه، رقمه، المشروع).

3) TICKET_LIST — عندما يريد "شوف شكاواي" أو "عندي كام تذكرة" أو "قائمة التذاكر".
   يحتاج: رقم واتساب الساكن فقط.

4) TICKET_GET — عندما يريد "حالة الشكوى رقم TICK-XXX" أو "استعلام عن تذكرتي".
   يحتاج: رقم واتساب الساكن + رقم الشكوى (مثل TICK-ABC12345).

5) DELIVERY_ORDER — عندما يريد "طلب توصيل" أو "استلام من الوحدة" أو "طلب إرسالية".
   يحتاج: رقم الساكن + كود الوحدة + وصف الطلب + معرف المشروع (أو يُستنتج من المفتاح).`

const ACTIONS_DEFINITION = [
  {
    action: "IDENTITY",
    whenToUse: "لتحديد هوية الرقم: أدمن، محاسب، مدير مشروع، ساكن، أو رقم غير مسجل.",
    payload: {
      phone: "رقم الهاتف (أو senderPhone / contact / query)",
      _optional: "أي حقل منهم يكفي."
    },
    requiredRole: "أي مفتاح (يُستخدم غالباً قبل معرفة الدور)."
  },
  {
    action: "TICKET_CREATE",
    whenToUse: "عندما يريد المستخدم تسجيل شكوى أو فتح تذكرة.",
    payload: {
      title: "عنوان (اختياري، يُستنتج من الوصف)",
      description: "وصف المشكلة (مطلوب)",
      unitCode: "كود الوحدة أو buildingNumber أو unitName (مطلوب)",
      residentName: "اسم المُبلّغ (اختياري)",
      residentPhone: "رقم المُبلّغ (اختياري)",
      senderPhone: "رقم المرسل (اختياري)",
      projectName: "اسم المشروع (اختياري)",
      priority: "أولوية: Normal / High (اختياري)"
    },
    requiredRole: "RESIDENT"
  },
  {
    action: "TICKET_LIST",
    whenToUse: "عندما يريد المستخدم عرض كل تذاكره (قائمة الشكاوى).",
    payload: {
      residentPhone: "رقم واتساب الساكن (مطلوب)"
    },
    requiredRole: "RESIDENT"
  },
  {
    action: "TICKET_GET",
    whenToUse: "عندما يريد المستخدم معرفة حالة تذكرة معينة برقم الشكوى.",
    payload: {
      residentPhone: "رقم واتساب الساكن (مطلوب)",
      ticketNumber: "رقم الشكوى مثل TICK-ABC12345 (مطلوب)"
    },
    requiredRole: "RESIDENT"
  },
  {
    action: "DELIVERY_ORDER",
    whenToUse: "عندما يريد المستخدم طلب توصيل أو استلام من الوحدة.",
    payload: {
      residentPhone: "رقم الساكن (مطلوب)",
      unitCode: "كود الوحدة (مطلوب)",
      description: "وصف الطلب أو orderText (مطلوب)",
      projectId: "معرف المشروع (مطلوب إن لم يكن المفتاح مربوط بمشروع)",
      residentName: "اسم الساكن (اختياري)"
    },
    requiredRole: "RESIDENT"
  },
  {
    action: "RESOLVE_UNIT",
    whenToUse: "لتأكيد الوحدة قبل فتح الشكوى — يطابق ما قاله الساكن (مشروع + عمارة/وحدة) ويرجع نتيجة واحدة فقط، بدون عرض قوائم.",
    payload: {
      projectName: "اسم المشروع/الكومباوند (مفضل مع unitName)",
      unitName: "اسم أو رقم العمارة/الوحدة (مثل عمارة ٣، مبنى 5)",
      unitCode: "كود الوحدة (إن وُجد)",
      buildingNumber: "رقم المبنى فقط"
    },
    requiredRole: "RESIDENT"
  }
] as const

type ActionType = (typeof ACTIONS_DEFINITION)[number]["action"]

export async function GET() {
  return NextResponse.json({
    tool: "resident",
    description: "أداة موحّدة: هوية الرقم، تذاكر الساكن، طلب توصيل.",
    prompt: RESIDENT_TOOL_PROMPT,
    actions: ACTIONS_DEFINITION,
    usage: "أرسل POST مع { action: \"ACTION_NAME\", ...payload } حسب الجدول أعلاه."
  })
}

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json().catch(() => ({}))
    const action = (body?.action ?? "").trim().toUpperCase() as ActionType

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing action",
          humanReadable: { ar: "أرسل action في الـ payload. استدعِ GET على نفس الرابط لرؤية البرومبت والـ actions." },
          actions: ACTIONS_DEFINITION.map((a) => a.action)
        },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const validActions: ActionType[] = ["IDENTITY", "TICKET_CREATE", "TICKET_LIST", "TICKET_GET", "DELIVERY_ORDER", "RESOLVE_UNIT"]
    if (!validActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown action: ${action}`,
          humanReadable: { ar: `القيمة ${action} غير صحيحة. القيم المسموحة: ${validActions.join(", ")}.` },
          actions: validActions
        },
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        botFail("مفتاح غير صالح أو غير مصرح. تحقق من المفتاح.", "UNAUTHORIZED"),
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    if (action === "IDENTITY") {
      const input = String(body?.phone ?? body?.senderPhone ?? body?.contact ?? body?.query ?? "").trim()
      if (!input) {
        return NextResponse.json(
          botFail("أرسل رقم الهاتف المطلوب التعرف عليه (phone أو senderPhone أو contact أو query).", "MISSING_PHONE"),
          { status: WEBHOOK_ALWAYS_OK }
        )
      }
      const data = await runIdentityLogic(input, auth.context, ipAddress, body as Record<string, unknown>)
      return NextResponse.json(data, { status: WEBHOOK_ALWAYS_OK })
    }

    if (auth.context.role !== "RESIDENT") {
      return NextResponse.json(
        botFail("هذا الطلب للسكان فقط. استخدم مفتاح ساكن.", "RESIDENT_ONLY"),
        { status: WEBHOOK_ALWAYS_OK }
      )
    }

    if (action === "TICKET_LIST") {
      const residentPhone = String(body?.residentPhone ?? body?.phone ?? "").trim()
      if (!residentPhone) {
        return NextResponse.json(
          botFail("مطلوب: residentPhone (رقم واتساب الساكن).", "MISSING_RESIDENT_PHONE"),
          { status: WEBHOOK_ALWAYS_OK }
        )
      }
      const data = await getTicketsFromWebhook({ residentPhone }, auth.context, ipAddress)
      return NextResponse.json(data, { status: WEBHOOK_ALWAYS_OK })
    }

    if (action === "TICKET_GET") {
      const residentPhone = String(body?.residentPhone ?? body?.phone ?? "").trim()
      const ticketNumber = body?.ticketNumber ?? body?.ticket_number ?? body?.number ?? null
      if (!residentPhone) {
        return NextResponse.json(
          botFail("مطلوب: residentPhone ورقم الشكوى (ticketNumber).", "MISSING_RESIDENT_PHONE"),
          { status: WEBHOOK_ALWAYS_OK }
        )
      }
      const data = await getTicketsFromWebhook({ residentPhone, ticketNumber }, auth.context, ipAddress)
      return NextResponse.json(data, { status: WEBHOOK_ALWAYS_OK })
    }

    if (action === "TICKET_CREATE") {
      const result = await createTicketFromWebhook(body, auth.context, ipAddress)
      return NextResponse.json(result.data, { status: WEBHOOK_ALWAYS_OK })
    }

    if (action === "RESOLVE_UNIT") {
      const result = await resolveUnit({
        projectName: body.projectName,
        unitName: body.unitName,
        unitCode: body.unitCode,
        buildingNumber: body.buildingNumber
      })
      return NextResponse.json(result.data, { status: WEBHOOK_ALWAYS_OK })
    }

    if (action === "DELIVERY_ORDER") {
      const data = await createDeliveryOrderFromWebhook(body as Record<string, unknown>, auth.context, ipAddress)
      return NextResponse.json(data, { status: WEBHOOK_ALWAYS_OK })
    }

    return NextResponse.json(
      botFail(`أكشن غير متوقع: ${action}`, "UNKNOWN_ACTION"),
      { status: WEBHOOK_ALWAYS_OK }
    )
  } catch (error) {
    console.error("RESIDENT_TOOL_ERROR", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run resident tool",
        humanReadable: { ar: "حدث خطأ أثناء تنفيذ الطلب." }
      },
      { status: WEBHOOK_ALWAYS_OK }
    )
  }
}
