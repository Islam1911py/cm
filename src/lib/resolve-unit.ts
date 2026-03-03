import { db } from "@/lib/db"
import {
  findProjectBySlugOrName,
  findUnitBySlugOrName,
  findCloseProjects,
  getUnitsForProject,
  normalizeArabicNumerals
} from "@/lib/project-slug"

export type ResolveUnitBody = {
  projectName?: string
  unitName?: string
  unitCode?: string
  buildingNumber?: string
}

/** عند نجاح مع تأكيد: البوت يعرض الرسالة ويسأل "مظبوط؟" */
export type ResolveUnitSuccessData = {
  success: true
  project: { id: string; name: string } | null
  unit: { id: string; code: string; name: string | null }
  humanReadable: { ar: string }
  needsConfirmation?: boolean
}

/** عند عدم وجود وحدة لكن المشروع موجود: نعرض قائمة الوحدات المتاحة */
export type ResolveUnitUnitListData = {
  success: false
  error: "unit_not_found"
  project: { id: string; name: string }
  availableUnits: { id: string; code: string; name: string | null }[]
  humanReadable: { ar: string }
}

/** عند عدة مشاريع قريبة: نعرض الخيارات */
export type ResolveUnitProjectCandidatesData = {
  success: false
  error: "project_candidates"
  projectCandidates: { id: string; name: string; slug: string }[]
  humanReadable: { ar: string }
}

export type ResolveUnitResult =
  | { status: 200; data: ResolveUnitSuccessData }
  | { status: 200; data: ResolveUnitUnitListData }
  | { status: 200; data: ResolveUnitProjectCandidatesData }
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
    let fuzzyProject = false
    if (projectName) {
      const resolved = await findProjectBySlugOrName(db, projectName)
      if (resolved) {
        project = { id: resolved.id, name: resolved.name }
      }
      if (!project) {
        const close = await findCloseProjects(db, projectName, 3, 2)
        if (close.length === 1) {
          project = { id: close[0].id, name: close[0].name }
          fuzzyProject = true
        } else if (close.length > 1) {
          const names = close.map((p) => p.name).join(" أو ")
          return {
            status: 200,
            data: {
              success: false,
              error: "project_candidates",
              projectCandidates: close,
              humanReadable: { ar: `حضرتك تقصد أي مشروع؟ ${names}` }
            }
          }
        } else {
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

    // كل البحث عن الوحدة داخل المشروع المُحدَّد فقط (مش أي عمارة 60 في الداتا — عمارة 60 في كومباوند البركة).
    if (requestedCode && projectId) {
      const found = await db.operationalUnit.findFirst({
        where: { code: { equals: requestedCode, mode: "insensitive" }, projectId },
        select: { id: true, code: true, name: true, projectId: true }
      })
      if (found) unit = found
    }

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
      // عمارة ٢ vs عمارة 2 — جرّب contains بالاسم بعد تطبيع الأرقام
      if (!unit) {
        const normName = normalizeArabicNumerals(unitName)
        if (normName !== unitName) {
          const byNormContains = await db.operationalUnit.findMany({
            where: {
              projectId,
              name: { contains: normName, mode: "insensitive" }
            },
            select: { id: true, code: true, name: true, projectId: true },
            take: 2
          })
          if (byNormContains.length === 1) unit = byNormContains[0]
          if (byNormContains.length > 1) {
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
      }
    }

    // مشروع موجود لكن وحدة غير موجودة → نرجع قائمة الوحدات المتاحة
    if (!unit && projectId && project) {
      const units = await getUnitsForProject(db, projectId)
      if (units.length > 0) {
        const maxShow = 10
        const labels = units.map((u) => u.name || `وحدة ${u.code}`)
        const list =
          labels.length <= maxShow
            ? labels.join("، ")
            : `${labels.slice(0, maxShow - 1).join("، ")} وغيرها (${units.length} وحدة)`
        const projectLabel = project.name
        return {
          status: 200,
          data: {
            success: false,
            error: "unit_not_found",
            project: { id: project.id, name: project.name },
            availableUnits: units,
            humanReadable: {
              ar: `احنا بنغطي: ${list} في ${projectLabel}. حضرتك تقصد أي وحدة من دول؟`
            }
          }
        }
      }
    }

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
    const projectNameForMsg = projectResolved?.name ?? "المشروع"
    const unitLabel = unit!.name || `عمارة ${unit!.code}`

    return {
      status: 200,
      data: {
        success: true,
        project: projectResolved ? { id: projectResolved.id, name: projectResolved.name } : null,
        unit: { id: unit!.id, code: unit!.code, name: unit!.name },
        humanReadable: {
          ar: fuzzyProject
            ? `حضرتك ${projectNameForMsg}، ${unitLabel} — مظبوط؟`
            : "تم التأكد من الوحدة. يمكنك متابعة فتح الشكوى."
        },
        needsConfirmation: fuzzyProject
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
