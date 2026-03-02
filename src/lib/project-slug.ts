import type { PrismaClient } from "@prisma/client"

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a", أ: "a", إ: "a", آ: "a", ء: "",
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh",
  ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", و: "w", ي: "y", ة: "a", ى: "a", ئ: "y", ؤ: "w"
}

function toSlugFromStrip(strip: string): string {
  let out = ""
  for (const char of strip) {
    if (/\s/.test(char)) { out += " "; continue }
    if (/[a-z0-9]/.test(char)) { out += char; continue }
    if (ARABIC_TO_LATIN[char] !== undefined) { out += ARABIC_TO_LATIN[char]; continue }
    if (/[\u0660-\u0669]/.test(char)) { out += String(char.charCodeAt(0) - 0x0660 + 0x30); continue }
    if (/[\u06f0-\u06f9]/.test(char)) { out += String(char.charCodeAt(0) - 0x06f0 + 0x30); continue }
  }
  return out.replace(/\s+/g, " ").trim()
}

/**
 * كود للمطابقة بين اسم عربي واسم إنجليزي.
 * المشروع قد يكون كومباوند، مشروع، محل، صيدلية، شاطئ، مستشفى، إلخ — نزيل نوع المكان ونطابق الاسم.
 * يستخدمه: الساكن (RESOLVE_UNIT)، الأدمن، المحاسب، مدير المشروع.
 */
export function projectNameToMatchSlug(name: string): string {
  const t = name.trim().toLowerCase()
  const strip = t
    .replace(/^ال(?=\p{L})/u, "")
    .replace(/كومباوند\s*/g, "")
    .replace(/مشروع\s*/g, "")
    .replace(/محل\s*/g, "")
    .replace(/صيدلية\s*/g, "")
    .replace(/شاطئ\s*/g, "")
    .replace(/مستشفى\s*/g, "")
    .replace(/مستشفي\s*/g, "")
    .replace(/الكومباوند\s*/g, "")
    .replace(/المشروع\s*/g, "")
    .replace(/المحل\s*/g, "")
    .replace(/الصيدلية\s*/g, "")
    .replace(/الشاطئ\s*/g, "")
    .replace(/المستشفى\s*/g, "")
    .replace(/المستشفي\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return toSlugFromStrip(strip)
}

/**
 * يبحث عن مشروع على مرحلتين: 1) تطابق slug، 2) fallback name contains.
 * بدون OR في الـ query — اعتماد على ID بعد الـ resolve داخلياً.
 */
export async function findProjectBySlugOrName(
  db: PrismaClient,
  projectName: string
): Promise<{ id: string; name: string; slug: string } | null> {
  const rawInput = projectName.trim()
  const inputSlug = projectNameToMatchSlug(projectName)

  // المرحلة 1: تطابق slug
  if (inputSlug) {
    const bySlug = await db.project.findFirst({
      where: { slug: inputSlug },
      select: { id: true, name: true, slug: true }
    })
    if (bySlug) return bySlug
  }

  // المرحلة 2: fallback name contains
  if (rawInput) {
    const byName = await db.project.findFirst({
      where: { name: { contains: rawInput, mode: "insensitive" } },
      select: { id: true, name: true, slug: true }
    })
    if (byName) return byName
  }

  return null
}

/** يُستخدم عند إنشاء مشروع: slug مطلوب ولا يكون فارغاً. */
export function projectSlugForCreate(name: string): string {
  const s = projectNameToMatchSlug(name)
  if (s) return s
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "project"
}

// —— وحدة (slug داخل المشروع فقط، ليس فريداً globally) ——

/** تطبيع اسم الوحدة للبحث (عمارة ١، مبنى 5، بلوك أ) — داخل المشروع فقط. */
export function unitNameToMatchSlug(name: string): string {
  const t = name.trim().toLowerCase()
  const strip = t
    .replace(/عمارة\s*/g, "")
    .replace(/مبنى\s*/g, "")
    .replace(/بلوك\s*/g, "")
    .replace(/برج\s*/g, "")
    .replace(/وحدة\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return toSlugFromStrip(strip)
}

/**
 * يبحث عن وحدة داخل مشروع معيّن: مرحلتين (slug ثم name contains)، بدون OR.
 * اعتماد على unitId بعد الـ resolve داخلياً.
 */
export async function findUnitBySlugOrName(
  db: PrismaClient,
  projectId: string,
  unitName: string
): Promise<{ id: string; code: string; name: string | null; projectId: string } | null> {
  const rawInput = unitName.trim()
  const inputSlug = unitNameToMatchSlug(unitName)

  const base = { projectId }

  if (inputSlug) {
    const bySlug = await db.operationalUnit.findFirst({
      where: { ...base, slug: inputSlug },
      select: { id: true, code: true, name: true, projectId: true }
    })
    if (bySlug) return bySlug
  }

  if (rawInput) {
    const byName = await db.operationalUnit.findFirst({
      where: { ...base, name: { contains: rawInput, mode: "insensitive" } },
      select: { id: true, code: true, name: true, projectId: true }
    })
    if (byName) return byName
  }

  return null
}
