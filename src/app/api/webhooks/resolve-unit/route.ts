import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { verifyN8nApiKey } from "@/lib/n8n-auth"

/**
 * POST /api/webhooks/resolve-unit
 *
 * يطابق ما قاله الساكن (اسم مشروع + اسم/رقم وحدة) ويُرجع نتيجة واحدة فقط.
 * لا يُرجع أبداً قائمة مشاريع أو وحدات — إما وحدة واحدة مطابقة أو رسالة خطأ.
 * يستخدمه البوت لتأكيد "تقصد كومباوند X - عمارة Y؟" قبل فتح التذكرة.
 *
 * Body: projectName?, unitName?, unitCode?, buildingNumber?
 * على الأقل: projectName أو (unitName أو unitCode أو buildingNumber) مع معرف المشروع من السياق غير متوفر هنا فيفضل إرسال projectName مع الوحدة.
 */
export async function POST(req: NextRequest) {
  try {
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
    const projectName = typeof body.projectName === "string" ? body.projectName.trim() : ""
    const unitName = typeof body.unitName === "string" ? body.unitName.trim() : ""
    const unitCode = typeof body.unitCode === "string" ? body.unitCode.trim() : ""
    const buildingNumber = typeof body.buildingNumber === "string" ? body.buildingNumber.trim() : ""
    const requestedCode = unitCode || buildingNumber || undefined

    if (!projectName && !unitName && !requestedCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing unit identifier",
          humanReadable: { ar: "أرسل اسم المشروع أو الكومباوند مع رقم/اسم العمارة أو الوحدة." }
        },
        { status: 400 }
      )
    }

    // Resolve project (مطلوب لو أرسلنا اسم مشروع؛ لو وحدة فقط نبحث في كل المشاريع)
    let project: { id: string; name: string } | null = null
    if (projectName) {
      project = await db.project.findFirst({
        where: { name: { equals: projectName, mode: "insensitive" } },
        select: { id: true, name: true }
      })
      if (!project) {
        const fallback = await db.$queryRaw<{ id: string; name: string }[]>(
          Prisma.sql`SELECT "id", "name" FROM "Project" WHERE LOWER("name") = LOWER(${projectName}) LIMIT 1`
        )
        if (fallback.length > 0) project = fallback[0]
      }
      if (!project) {
        return NextResponse.json(
          {
            success: false,
            error: "Project not found",
            humanReadable: { ar: `لا يوجد مشروع مطابق لـ "${projectName}". تأكد من الاسم أو اسأل الإدارة.` }
          },
          { status: 404 }
        )
      }
    }

    // إذا أرسل وحدة فقط بدون مشروع، نبحث في كل المشاريع (أول تطابق)
    const projectId = project?.id ?? null

    if (!unitName && !requestedCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing unit identifier",
          humanReadable: { ar: "أرسل رقم أو اسم العمارة/الوحدة (مثلاً عمارة ٣ أو مبنى 5)." }
        },
        { status: 400 }
      )
    }

    type UnitRow = { id: string; code: string; name: string | null; projectId: string }
    let unit: UnitRow | null = null

    if (requestedCode && projectId) {
      const found = await db.operationalUnit.findFirst({
        where: { code: { equals: requestedCode, mode: "insensitive" }, projectId },
        select: { id: true, code: true, name: true, projectId: true }
      })
      if (found) unit = found
    }

    if (!unit && unitName && projectId) {
      const exact = await db.operationalUnit.findFirst({
        where: { name: { equals: unitName, mode: "insensitive" }, projectId },
        select: { id: true, code: true, name: true, projectId: true }
      })
      if (exact) unit = exact
    }

    if (!unit && unitName && projectId) {
      const byContains = await db.operationalUnit.findMany({
        where: {
          projectId,
          name: { contains: unitName, mode: "insensitive" }
        },
        select: { id: true, code: true, name: true, projectId: true },
        take: 2
      })
      if (byContains.length === 1) unit = byContains[0]
      if (byContains.length > 1) {
        return NextResponse.json(
          {
            success: false,
            error: "multiple_matches",
            humanReadable: { ar: "أكثر من وحدة مطابقة. حدد أكثر (مثلاً اسم المشروع ورقم العمارة بوضوح)." }
          },
          { status: 400 }
        )
      }
    }

    if (!unit && (unitName || requestedCode)) {
      const projectsToSearch = projectId ? [projectId] : (await db.project.findMany({ select: { id: true } })).map((p) => p.id)
      for (const pid of projectsToSearch) {
        if (requestedCode) {
          const u = await db.operationalUnit.findFirst({
            where: { projectId: pid, code: { equals: requestedCode, mode: "insensitive" } },
            select: { id: true, code: true, name: true, projectId: true }
          })
          if (u) { unit = u; break }
        }
        if (!unit && unitName) {
          const u = await db.operationalUnit.findFirst({
            where: { projectId: pid, name: { contains: unitName, mode: "insensitive" } },
            select: { id: true, code: true, name: true, projectId: true }
          })
          if (u) { unit = u; break }
        }
      }
    }

    if (!unit) {
      return NextResponse.json(
        {
          success: false,
          error: "Unit not found",
          humanReadable: { ar: "لم نجد وحدة مطابقة. تأكد من اسم المشروع ورقم/اسم العمارة." }
        },
        { status: 404 }
      )
    }

    const projectResolved = project ?? await db.project.findUnique({
      where: { id: unit.projectId },
      select: { id: true, name: true }
    })

    return NextResponse.json({
      success: true,
      project: projectResolved ? { id: projectResolved.id, name: projectResolved.name } : null,
      unit: { id: unit.id, code: unit.code, name: unit.name },
      humanReadable: {
        ar: projectResolved
          ? `تقصد: ${projectResolved.name} — ${unit.name || unit.code}`
          : `الوحدة: ${unit.name || unit.code}`
      }
    })
  } catch (e) {
    console.error("resolve-unit", e)
    return NextResponse.json(
      { success: false, error: "Internal error", humanReadable: { ar: "حدث خطأ. حاول مرة أخرى." } },
      { status: 500 }
    )
  }
}
