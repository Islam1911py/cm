import type { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a", أ: "a", إ: "a", آ: "a", ء: "",
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh",
  ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", و: "w", ي: "y", ة: "a", ى: "a", ئ: "y", ؤ: "w"
}

/** كاف فارسي/أردي (ک U+06A9) → ك عربي — عشان "کرمه" و "كرمة" يطابقوا نفس المشروع */
const ARABIC_LOOKALIKES: Record<string, string> = {
  "\u06A9": "\u0643", // Persian/Urdū Kaf → Arabic Kaf
  "\u06CC": "\u064A"  // Persian Ye (ي) → Arabic Ya
}
function normalizeArabicLookalikes(s: string): string {
  let out = s
  for (const [from, to] of Object.entries(ARABIC_LOOKALIKES)) {
    out = out.split(from).join(to)
  }
  return out
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
/** تطبيع ه/ة في آخر الكلمة — كرمه وكرمة نفس المطابقة لأسماء الأماكن */
function normalizeTaMarbuta(s: string): string {
  return s.replace(/ه\s/g, "ة ").replace(/ه$/u, "ة")
}

/**
 * قاعدة ذهبية (Search Engine):
 * مش كل كلمة شائعة = Type. في فرق بين:
 * - Type Word (كومباوند، مول، مشروع) → آمنة للإزالة من النص قبل الـ slug.
 * - Brand Word (سيتي، مارينا، بلازا) → جزء من الاسم؛ نطبّعها فقط ولا نزيلها (تجنب collision: "سيتي ستارز" ≠ "ستارز").
 *
 * Level 2 مستقبلاً: Ranking Engine — سيب الاسم كامل واحسب score بدل حذف كلمات كتير.
 * أداء: كل input بيمر على تطبيع ثم strip (عشرات الـ replace). لما المشاريع تكتر يُفضّل مراجعة (مثلاً خريطة واحدة أو ranking بدل strip كثير).
 */
type PlaceTypeGroup = { canonical: string; variants: string[] }

/** Strong Types: آمنة للإزالة — نوع المكان الحقيقي (نُزيل قبل بناء الـ slug). */
const STRONG_PLACE_TYPE_GROUPS: PlaceTypeGroup[] = [
  { canonical: "كومباوند", variants: ["كمبوند", "كمبواند", "كامباوند", "كومبوند", "كمباوند", "الكمباوند", "الكمبوند", "الكومباوند"] },
  { canonical: "مشروع", variants: ["مشرووع", "مشرورع", "المشروع", "مشاريع"] },
  { canonical: "محل", variants: ["المحل", "محلات"] },
  { canonical: "صيدلية", variants: ["صيدليه", "الصيدلية", "صيدليات"] },
  { canonical: "شاطئ", variants: ["شاطي", "الشاطئ", "شواطئ"] },
  { canonical: "مستشفى", variants: ["مستشفي", "المستشفى", "مستشفيات"] },
  { canonical: "بركة", variants: ["بركه", "بركا", "البركة"] },
  { canonical: "صواري", variants: ["سواري", "الصواري", "swary", "sawary"] },
  { canonical: "ريسيدنس", variants: ["ريسيدانس", "residence", "الريسيدنس"] },
  { canonical: "مول", variants: ["المول", "مولات", "مال"] },
  { canonical: "هايبر", variants: ["هايبرماركت", "هايبر ماركت", "الهايبر", "hyper", "hypermarket"] },
  { canonical: "سوبر ماركت", variants: ["سوبرماركت", "السوبر ماركت", "سوبر ماركت", "supermarket", "super market"] },
  { canonical: "فندق", variants: ["الفندق", "فنادق", "هوتيل", "هوتل", "hotel", "hotels"] },
  { canonical: "مجمع", variants: ["المجمع", "مجمعات"] },
  { canonical: "قرية", variants: ["القرية", "قرى"] },
  { canonical: "عقار", variants: ["العقار", "عقارات", "مشروع عقاري"] },
  { canonical: "اوتلت", variants: ["أوتلت", "اوتلت", "outlet", "outlets", "الاوتلت"] },
  { canonical: "كلينيك", variants: ["كلينك", "الكلينيك", "عيادة", "العيادة", "عيادات", "clinic", "clinics"] },
  { canonical: "مركز طبي", variants: ["المركز الطبي", "مراكز طبية", "ميديكال سنتر", "medical center"] },
  { canonical: "جامعة", variants: ["الجامعة", "جامعات", "university"] },
  { canonical: "مدرسة", variants: ["المدرسة", "مدارس", "سكول", "school", "schools"] },
  { canonical: "حضانة", variants: ["الحضانة", "حضانات", "كي جي", "kg", "روضة", "الروضة"] },
  { canonical: "نادي", variants: ["النادي", "أندية", "اندية", "club", "clubs"] },
  { canonical: "فيلا", variants: ["الفيلا", "فيلات", "villa", "villas"] },
  { canonical: "تاون هاوس", variants: ["تاونهاوس", "townhouse", "town house", "التاون هاوس"] },
  { canonical: "حديقة", variants: ["الحديقة", "حدائق", "بارك", "park", "البارك"] },
  { canonical: "مصنع", variants: ["المصنع", "مصانع", "فاكتوري", "factory", "factories"] },
  { canonical: "مكتب", variants: ["المكتب", "مكاتب", "أوفيس", "office", "offices"] }
]

/** Weak Types: تطبيع فقط — لا تُزال (غالباً جزء من الاسم: سيتي ستارز، برج العرب، مول سيتي سنتر). */
const WEAK_PLACE_TYPE_GROUPS: PlaceTypeGroup[] = [
  { canonical: "سنتر", variants: ["سنتير", "السنتر", "سنترز", "center", "centers"] },
  { canonical: "بلازا", variants: ["البلازا", "plaza", "بلازات"] },
  { canonical: "ريزورت", variants: ["الريزورت", "ريسورت", "resort", "resorts"] },
  { canonical: "لاند مارك", variants: ["لاندمارك", "landmark", "landmarks", "اللاند مارك"] },
  { canonical: "سيتي", variants: ["city", "السيتي"] },
  { canonical: "مارينا", variants: ["المارينا", "marina"] },
  { canonical: "كورنيش", variants: ["الكورنيش"] },
  { canonical: "منطقة", variants: ["المنطقة", "مناطق", "زون", "zone", "الزون"] },
  { canonical: "برج", variants: ["البرج", "أبراج", "تاور", "tower", "towers"] }
]

/** كل الأنواع (strong + weak) للتطبيع؛ الـ strip يستخدم strong فقط. */
const ALL_PLACE_TYPE_GROUPS = [...STRONG_PLACE_TYPE_GROUPS, ...WEAK_PLACE_TYPE_GROUPS]

function buildPlaceAliases(groups: PlaceTypeGroup[]): [RegExp, string][] {
  const pairs: [RegExp, string][] = []
  for (const { canonical, variants } of groups) {
    for (const v of variants) {
      if (v !== canonical) pairs.push([new RegExp(escapeRe(v), "g"), canonical])
    }
  }
  return pairs
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const PLACE_TYPE_ALIASES = buildPlaceAliases(ALL_PLACE_TYPE_GROUPS)

function normalizePlaceTypeAliases(s: string): string {
  let out = s
  for (const [re, to] of PLACE_TYPE_ALIASES) {
    out = out.replace(re, to)
  }
  return out
}

// ─── مرادفات نوع الوحدة (عمارة، مبنى، بلوك…) — نفس الفكرة: زود variants وجرب ───
const UNIT_TYPE_GROUPS: { canonical: string; variants: string[] }[] = [
  { canonical: "عمارة", variants: ["عماره", "العمارة", "عمارات"] },
  { canonical: "مبنى", variants: ["مبني", "المبنى", "مباني"] },
  { canonical: "بلوك", variants: ["البلوك"] },
  { canonical: "برج", variants: ["البرج", "أبراج"] },
  { canonical: "وحدة", variants: ["وحده", "الوحدة", "وحدات"] }
]

function buildUnitAliases(): [RegExp, string][] {
  const pairs: [RegExp, string][] = []
  for (const { canonical, variants } of UNIT_TYPE_GROUPS) {
    for (const v of variants) {
      if (v !== canonical) pairs.push([new RegExp(escapeRe(v), "g"), canonical])
    }
  }
  return pairs
}

const UNIT_TYPE_ALIASES = buildUnitAliases()

function normalizeUnitTypeAliases(s: string): string {
  let out = s
  for (const [re, to] of UNIT_TYPE_ALIASES) {
    out = out.replace(re, to)
  }
  return out
}

/** أرقام عربية/فارسية → لاتينية (عمارة ٢ = عمارة 2) — مُصدَّر لاستخدامه في ويب هوك التذاكر */
export function normalizeArabicNumerals(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660 + 0x30))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0 + 0x30))
}

/** يُزال نوع المكان من النص قبل الـ slug — Strong Types فقط (Weak تبقى في الاسم). */
function stripPlaceTypes(s: string): string {
  let out = s.replace(/^ال(?=\p{L})/u, "")
  for (const { canonical } of STRONG_PLACE_TYPE_GROUPS) {
    const c = escapeRe(canonical)
    out = out.replace(new RegExp(c + "\\s*", "g"), "").replace(new RegExp("ال" + c + "\\s*", "g"), "")
  }
  // إزالة "ال" من أول النص المتبقي (مثلاً "الكرمة" → "كرمة") عشان المطابقة مع اسم مسجّل بالإنجليزي (karma)
  out = out.replace(/^\s*ال(?=\p{L})/u, "").trim()
  return out.replace(/\s+/g, " ").trim()
}

export function projectNameToMatchSlug(name: string): string {
  const t = name.trim().toLowerCase()
  const withLookalikes = normalizeArabicLookalikes(t)
  const withAliases = normalizePlaceTypeAliases(withLookalikes)
  const afterTaMarbuta = normalizeTaMarbuta(withAliases)
  const strip = stripPlaceTypes(afterTaMarbuta)
  const toStrip = strip.length > 0 ? strip : afterTaMarbuta
  return toSlugFromStrip(toStrip)
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
  const normalizedInput = normalizeTaMarbuta(normalizeArabicLookalikes(rawInput))
  const inputSlug = projectNameToMatchSlug(normalizedInput)

  // المرحلة 1: تطابق slug
  if (inputSlug) {
    const bySlug = await db.project.findFirst({
      where: { slug: inputSlug },
      select: { id: true, name: true, slug: true }
    })
    if (bySlug) return bySlug
  }

  // المرحلة 2: fallback name contains (مع تطبيع ک→ك، كرمه→كرمة)
  if (normalizedInput) {
    const byName = await db.project.findFirst({
      where: { name: { contains: normalizedInput, mode: "insensitive" } },
      select: { id: true, name: true, slug: true }
    })
    if (byName) return byName
    if (rawInput !== normalizedInput) {
      const byRaw = await db.project.findFirst({
        where: { name: { contains: rawInput, mode: "insensitive" } },
        select: { id: true, name: true, slug: true }
      })
      if (byRaw) return byRaw
    }
  }

  // المرحلة 3: مطابقة بالـ slug المحسوب من الاسم — أي مشروع (حتى لو slug في الداتا null) يطابق من اسمه
  if (inputSlug) {
    const all = await db.project.findMany({ select: { id: true, name: true, slug: true } })
    const byComputedSlug = all.find((p) => projectNameToMatchSlug(p.name) === inputSlug)
    if (byComputedSlug) {
      if (byComputedSlug.slug == null) {
        const newSlug = projectSlugForCreate(byComputedSlug.name)
        db.project.update({ where: { id: byComputedSlug.id }, data: { slug: newSlug } }).catch(() => {})
      }
      return { id: byComputedSlug.id, name: byComputedSlug.name, slug: byComputedSlug.slug ?? projectSlugForCreate(byComputedSlug.name) }
    }
  }

  // المرحلة 4: مطابقة تقريبية — pg_trgm (similarity ثم word_similarity) إن وُجد، وإلا fallback لـ Node (Levenshtein)
  if (inputSlug) {
    const smart = await findProjectSmart(db, inputSlug, { maxCandidates: 5, minSimilarity: SIMILARITY_THRESHOLD })
    if (smart && smart.length === 1) return { id: smart[0].id, name: smart[0].name, slug: smart[0].slug }
    if (smart && smart.length > 1 && smart[0].sim - smart[1].sim >= 0.15) return { id: smart[0].id, name: smart[0].name, slug: smart[0].slug }
    const byWord = await findProjectByWordSimilarity(db, inputSlug, normalizedInput)
    if (byWord) return byWord
  }
  const close = await findCloseProjects(db, normalizedInput, 5, 2)
  if (close.length === 1) return close[0]
  if (close.length > 1) {
    const bestDist = slugLevenshtein(inputSlug || "", close[0].slug ?? "")
    const sameDist = close.filter((p) => slugLevenshtein(inputSlug || "", p.slug ?? "") === bestDist)
    if (sameDist.length === 1) return sameDist[0]
  }
  return null
}

/** يُستخدم عند إنشاء مشروع: slug مطلوب ولا يكون فارغاً. */
export function projectSlugForCreate(name: string): string {
  const s = projectNameToMatchSlug(name)
  if (s) return s
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "project"
}

/** مسافة التحرير بين slugين — للمطابقة المرنة (كارما/كرمة، بركة/بركا). */
export function slugLevenshtein(a: string, b: string): number {
  const na = a.length
  const nb = b.length
  const d: number[][] = Array(na + 1)
    .fill(null)
    .map(() => Array(nb + 1).fill(0))
  for (let i = 0; i <= na; i++) d[i][0] = i
  for (let j = 0; j <= nb; j++) d[0][j] = j
  for (let i = 1; i <= na; i++) {
    for (let j = 1; j <= nb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[na][nb]
}

/** مشاريع قريبة من الاسم (slug شبيه) — للعرض كخيارات أو تأكيد واحد. (Fallback لو pg_trgm مش مفعّل.) */
export async function findCloseProjects(
  db: PrismaClient,
  projectName: string,
  maxCandidates: number = 3,
  maxDistance: number = 2
): Promise<{ id: string; name: string; slug: string }[]> {
  const inputSlug = projectNameToMatchSlug(projectName)
  if (!inputSlug) return []
  const all = await db.project.findMany({
    where: { slug: { not: null } },
    select: { id: true, name: true, slug: true }
  })
  const withDistance = all
    .filter((p): p is { id: string; name: string; slug: string } => p.slug != null)
    .map((p) => ({ ...p, distance: slugLevenshtein(inputSlug, p.slug!) }))
    .filter((p) => p.distance <= maxDistance || p.slug!.includes(inputSlug) || inputSlug.includes(p.slug!))
  withDistance.sort((a, b) => a.distance - b.distance)
  return withDistance.slice(0, maxCandidates).map(({ distance: _d, ...rest }) => rest)
}

export const SIMILARITY_THRESHOLD = 0.3

type ProjectRow = { id: string; name: string; slug: string | null }

/**
 * مطابقة تقريبية على مستوى الداتابيز (pg_trgm).
 * المدخل: searchKey = slug محسوب من الاسم (كرمة/كارما → karma).
 * يرجع مشروع واحد لو واضح، أو مصفوفة مرشحين.
 * لو الـ extension مش مفعّل يقع في fallback لـ findCloseProjects.
 */
export type ProjectWithSimilarity = { id: string; name: string; slug: string; sim: number }

export async function findProjectSmart(
  db: PrismaClient,
  searchKey: string,
  options?: { maxCandidates?: number; minSimilarity?: number }
): Promise<ProjectWithSimilarity[] | null> {
  const maxCandidates = options?.maxCandidates ?? 5
  const minSim = options?.minSimilarity ?? SIMILARITY_THRESHOLD
  if (!searchKey || searchKey.length < 2) return null

  try {
    const rows = await db.$queryRaw<(ProjectRow & { sim: number })[]>(
      Prisma.sql`
        SELECT id, name, slug,
               GREATEST(
                 COALESCE(similarity(slug, ${searchKey}), 0),
                 COALESCE(similarity(COALESCE(name, ''), ${searchKey}), 0)
               ) AS sim
        FROM "Project"
        WHERE slug IS NOT NULL
        ORDER BY sim DESC
        LIMIT ${maxCandidates}
      `
    )
    const above = rows.filter((r) => r.sim >= minSim)
    if (above.length === 0) return null
    return above.map(({ id, name, slug, sim }) => ({ id, name, slug: slug ?? "", sim }))
  } catch {
    return null
  }
}

/** مطابقة بـ word_similarity (pg_trgm) على الـ slug والـ name — عشان نلقط slug لاتيني واسم عربي. */
const WORD_SIMILARITY_THRESHOLD = 0.35

export async function findProjectByWordSimilarity(
  db: PrismaClient,
  searchKeyLatin: string,
  searchKeyArabic?: string | null
): Promise<{ id: string; name: string; slug: string } | null> {
  const latin = searchKeyLatin?.trim() ?? ""
  const arabic = (searchKeyArabic?.trim() && searchKeyArabic !== latin) ? searchKeyArabic.trim() : latin
  if (latin.length < 2 && arabic.length < 2) return null
  try {
    const rows = await db.$queryRaw<(ProjectRow & { wsim: number })[]>(
      Prisma.sql`
        SELECT id, name, slug,
               GREATEST(
                 COALESCE(word_similarity(slug, ${latin}), 0),
                 COALESCE(word_similarity(COALESCE(name, ''), ${latin}), 0),
                 COALESCE(word_similarity(COALESCE(name, ''), ${arabic}), 0)
               ) AS wsim
        FROM "Project"
        WHERE (
          (slug IS NOT NULL AND word_similarity(slug, ${latin}) > ${WORD_SIMILARITY_THRESHOLD})
          OR (name IS NOT NULL AND word_similarity(name, ${latin}) > ${WORD_SIMILARITY_THRESHOLD})
          OR (name IS NOT NULL AND word_similarity(name, ${arabic}) > ${WORD_SIMILARITY_THRESHOLD})
        )
        ORDER BY wsim DESC
        LIMIT 3
      `
    )
    if (rows.length === 0) return null
    if (rows.length === 1) return { id: rows[0].id, name: rows[0].name, slug: rows[0].slug ?? "" }
    if (rows.length >= 2 && (rows[0].wsim - rows[1].wsim) >= 0.15) return { id: rows[0].id, name: rows[0].name, slug: rows[0].slug ?? "" }
    return null
  } catch {
    return null
  }
}

/** وحدات المشروع للعرض: "احنا بنغطي عمارة 1، 2، 3". */
export async function getUnitsForProject(
  db: PrismaClient,
  projectId: string
): Promise<{ id: string; code: string; name: string | null }[]> {
  return db.operationalUnit.findMany({
    where: { projectId },
    select: { id: true, code: true, name: true },
    orderBy: [{ code: "asc" }, { name: "asc" }]
  })
}

// —— وحدة (slug داخل المشروع فقط، ليس فريداً globally) ——

/** يُزال أنواع الوحدات من النص قبل بناء الـ slug — من UNIT_TYPE_GROUPS. */
function stripUnitTypes(s: string): string {
  let out = s
  for (const { canonical } of UNIT_TYPE_GROUPS) {
    const c = escapeRe(canonical)
    out = out.replace(new RegExp(c + "\\s*", "g"), "").replace(new RegExp("ال" + c + "\\s*", "g"), "")
  }
  return out.replace(/\s+/g, " ").trim()
}

/** تطبيع اسم الوحدة للبحث (عمارة ١، مبنى 5، بلوك أ) — داخل المشروع فقط. */
export function unitNameToMatchSlug(name: string): string {
  const t = name.trim().toLowerCase()
  const withUnitAliases = normalizeUnitTypeAliases(t)
  const strip = stripUnitTypes(withUnitAliases)
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
    // عمارة ٢ → slug "2"؛ لو الوحدة مسجّلة بالكود "2" فقط (والاسم مختلف أو slug فاضي) نطابق بالكود
    const byCode = await db.operationalUnit.findFirst({
      where: { ...base, code: { equals: inputSlug, mode: "insensitive" } },
      select: { id: true, code: true, name: true, projectId: true }
    })
    if (byCode) return byCode
  }

  if (rawInput) {
    const byName = await db.operationalUnit.findFirst({
      where: { ...base, name: { contains: rawInput, mode: "insensitive" } },
      select: { id: true, code: true, name: true, projectId: true }
    })
    if (byName) return byName
    const normalized = normalizeArabicNumerals(rawInput)
    if (normalized !== rawInput) {
      const byNorm = await db.operationalUnit.findFirst({
        where: { ...base, name: { contains: normalized, mode: "insensitive" } },
        select: { id: true, code: true, name: true, projectId: true }
      })
      if (byNorm) return byNorm
    }
  }

  return null
}
