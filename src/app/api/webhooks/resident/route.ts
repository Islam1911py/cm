import { NextRequest, NextResponse } from "next/server"

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

function getOrigin(req: NextRequest): string {
  try {
    const u = new URL(req.url)
    if (u.origin && u.origin !== "null") return u.origin
  } catch {}
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (base) return base.startsWith("http") ? base : `https://${base}`
  return "http://localhost:3000"
}

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
  const apiKey = req.headers.get("x-api-key") || ""
  const origin = getOrigin(req)

  try {
    const body = await req.json().catch(() => ({}))
    const action = (body?.action ?? "").trim().toUpperCase() as ActionType

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-forwarded-for": ipAddress
    }

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing action",
          humanReadable: { ar: "أرسل action في الـ payload. استدعِ GET على نفس الرابط لرؤية البرومبت والـ actions." },
          actions: ACTIONS_DEFINITION.map((a) => a.action)
        },
        { status: 400 }
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
        { status: 400 }
      )
    }

    let targetUrl: string
    let method: "GET" | "POST" = "POST"
    let fetchBody: string | undefined

    if (action === "IDENTITY") {
      targetUrl = `${origin}/api/webhooks/identity`
      method = "POST"
      fetchBody = JSON.stringify({
        phone: body.phone ?? body.senderPhone ?? body.contact ?? body.query
      })
    } else if (action === "TICKET_LIST") {
      const residentPhone = body.residentPhone ?? body.phone
      targetUrl = `${origin}/api/webhooks/tickets?residentPhone=${encodeURIComponent(residentPhone ?? "")}`
      method = "GET"
    } else if (action === "TICKET_GET") {
      const residentPhone = body.residentPhone ?? body.phone
      const ticketNumber = body.ticketNumber ?? body.ticket_number ?? body.number
      const params = new URLSearchParams()
      if (residentPhone) params.set("residentPhone", residentPhone)
      if (ticketNumber) params.set("ticketNumber", ticketNumber)
      targetUrl = `${origin}/api/webhooks/tickets?${params.toString()}`
      method = "GET"
    } else if (action === "TICKET_CREATE") {
      targetUrl = `${origin}/api/webhooks/tickets`
      method = "POST"
      fetchBody = JSON.stringify({
        residentName: body.residentName,
        residentEmail: body.residentEmail,
        residentPhone: body.residentPhone,
        senderPhone: body.senderPhone,
        unitCode: body.unitCode,
        unitName: body.unitName,
        buildingNumber: body.buildingNumber,
        projectName: body.projectName,
        title: body.title,
        description: body.description,
        priority: body.priority
      })
    } else if (action === "RESOLVE_UNIT") {
      targetUrl = `${origin}/api/webhooks/resolve-unit`
      method = "POST"
      fetchBody = JSON.stringify({
        projectName: body.projectName,
        unitName: body.unitName,
        unitCode: body.unitCode,
        buildingNumber: body.buildingNumber
      })
    } else {
      targetUrl = `${origin}/api/webhooks/delivery-orders`
      method = "POST"
      fetchBody = JSON.stringify({
        residentPhone: body.residentPhone,
        residentName: body.residentName,
        unitCode: body.unitCode,
        description: body.description ?? body.orderText,
        orderText: body.orderText ?? body.description,
        projectId: body.projectId
      })
    }

    const res = await fetch(targetUrl, {
      method,
      headers,
      ...(fetchBody && { body: fetchBody })
    })

    const data = await res.json().catch(() => ({ error: "Invalid JSON from upstream" }))
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error("RESIDENT_TOOL_ERROR", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run resident tool",
        humanReadable: { ar: "حدث خطأ أثناء تنفيذ الطلب." }
      },
      { status: 500 }
    )
  }
}
