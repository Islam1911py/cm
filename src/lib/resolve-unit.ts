import { db } from "@/lib/db"
import { findProjectBySlugOrName, findUnitBySlugOrName } from "@/lib/project-slug"

export type ResolveUnitBody = {
  projectName?: string
  unitName?: string
  unitCode?: string
  buildingNumber?: string
}

export type ResolveUnitResult =
  | { status: 200; data: { success: true; project: { id: string } | null; unit: { id: string; code: string }; humanReadable: { ar: string } } }
  | { status: 400; data: { success: false; error: string; humanReadable: { ar: string } } }
  | { status: 404; data: { success: false; error: string; humanReadable: { ar: string } } }
  | { status: 500; data: { success: false; error: string; humanReadable: { ar: string } } }

/**
 * Core logic for resolving project + unit from resident input.
 * Used by both /api/webhooks/resolve-unit and resident route (RESOLVE_UNIT) to avoid internal fetch.
 */
export async function resolveUnit(body: ResolveUnitBody): Promise<ResolveUnitResult> {
  try {
    const projectName = typeof body.projectName === "string" ? body.projectName.trim() : ""
    const unitName = typeof body.unitName === "string" ? body.unitName.trim() : ""
    const unitCode = typeof body.unitCode === "string" ? body.unitCode.trim() : ""
    const buildingNumber = typeof body.buildingNumber === "string" ? body.buildingNumber.trim() : ""
    const requestedCode = unitCode || buildingNumber || undefined

    if (!projectName && !unitName && !requestedCode) {
      return {
        status: 400,
        data: {
          success: false,
          error: "Missing unit identifier",
          humanReadable: { ar: "أرسل اسم المشروع أو الكومباوند مع رقم/اسم العمارة أو الوحدة." }
        }
      }
    }

    // المشروع مطلوب — مفيش search خارج المشروع (لا نربط وحدة بمشروع غلط)
    if (unitName || requestedCode) {
      if (!projectName) {
        return {
          status: 400,
          data: {
            success: false,
            error: "Project required",
            humanReadable: { ar: "حدد اسم المشروع أو الكومباوند أولاً ثم رقم/اسم العمارة (مثلاً: كومباوند كرمة، عمارة ٢)." }
          }
        }
      }
    }

    let project: { id: string; name: string } | null = null
    if (projectName) {
      // مرحلتين: slug ثم fallback name contains (بدون OR)، ثم اعتماد على projectId
      const resolved = await findProjectBySlugOrName(db, projectName)
      if (resolved) project = { id: resolved.id, name: resolved.name }
      if (!project) {
        return {
          status: 404,
          data: {
            success: false,
            error: "Project not found",
            humanReadable: { ar: "لم نجد مشروعًا مطابقًا. اذكر اسم الكومباوند أو المشروع كما تعرفه ثم رقم أو اسم العمارة." }
          }
        }
      }
    }

    const projectId = project?.id ?? null

    if (!unitName && !requestedCode) {
      return {
        status: 400,
        data: {
          success: false,
          error: "Missing unit identifier",
          humanReadable: { ar: "أرسل رقم أو اسم العمارة/الوحدة (مثلاً عمارة ٣ أو مبنى 5)." }
        }
      }
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

    // مرحلتين: slug ثم fallback name (بدون OR)
    if (!unit && unitName && projectId) {
      const bySlug = await findUnitBySlugOrName(db, projectId, unitName)
      if (bySlug) unit = bySlug
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
        return {
          status: 400,
          data: {
            success: false,
            error: "multiple_matches",
            humanReadable: { ar: "أكثر من وحدة مطابقة. حدد أكثر (مثلاً اسم المشروع ورقم العمارة بوضوح)." }
          }
        }
      }
    }

    // مفيش search خارج المشروع — matching داخل المشروع فقط (deterministic، لا وحدة غلط)
    if (!unit) {
      return {
        status: 404,
        data: {
          success: false,
          error: "Unit not found",
          humanReadable: { ar: "لم نجد وحدة مطابقة. تأكد من اسم المشروع ورقم/اسم العمارة." }
        }
      }
    }

    const projectResolved = project ?? await db.project.findUnique({
      where: { id: unit!.projectId },
      select: { id: true, name: true }
    })

    return {
      status: 200,
      data: {
        success: true,
        project: projectResolved ? { id: projectResolved.id } : null,
        unit: { id: unit!.id, code: unit!.code },
        humanReadable: { ar: "تم التأكد من الوحدة. يمكنك متابعة فتح الشكوى." }
      }
    }
  } catch (e) {
    console.error("resolveUnit", e)
    return {
      status: 500,
      data: { success: false, error: "Internal error", humanReadable: { ar: "حدث خطأ. حاول مرة أخرى." } }
    }
  }
}
