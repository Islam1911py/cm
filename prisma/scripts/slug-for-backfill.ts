/**
 * نسخة من منطق projectSlugForCreate للاستخدام داخل سكربتات prisma فقط.
 * مطلوبة لأن الـ container (Coolify) قد لا يحتوي على src/ — السكربت يعمل بدون الاعتماد على @/.
 * يرجى مزامنة التعديلات مع src/lib/project-slug.ts عند تغيير منطق الـ slug.
 */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a", أ: "a", إ: "a", آ: "a", ء: "",
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh",
  ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", و: "w", ي: "y", ة: "a", ى: "a", ئ: "y", ؤ: "w"
}
const ARABIC_LOOKALIKES: Record<string, string> = {
  "\u06A9": "\u0643",
  "\u06CC": "\u064A"
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
function normalizeTaMarbuta(s: string): string {
  return s.replace(/ه\s/g, "ة ").replace(/ه$/u, "ة")
}
type PlaceTypeGroup = { canonical: string; variants: string[] }
const STRONG_PLACE_TYPE_GROUPS: PlaceTypeGroup[] = [
  { canonical: "كومباوند", variants: ["كمبوند", "كمبواند", "كامباوند", "كومبوند", "كمباوند", "الكمباوند", "الكمبوند"] },
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
const ALL_PLACE_TYPE_GROUPS = [...STRONG_PLACE_TYPE_GROUPS, ...WEAK_PLACE_TYPE_GROUPS]
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function buildPlaceAliases(groups: PlaceTypeGroup[]): [RegExp, string][] {
  const pairs: [RegExp, string][] = []
  for (const { canonical, variants } of groups) {
    for (const v of variants) {
      if (v !== canonical) pairs.push([new RegExp(escapeRe(v), "g"), canonical])
    }
  }
  return pairs
}
const PLACE_TYPE_ALIASES = buildPlaceAliases(ALL_PLACE_TYPE_GROUPS)
function normalizePlaceTypeAliases(s: string): string {
  let out = s
  for (const [re, to] of PLACE_TYPE_ALIASES) {
    out = out.replace(re, to)
  }
  return out
}
function stripPlaceTypes(s: string): string {
  let out = s.replace(/^ال(?=\p{L})/u, "")
  for (const { canonical } of STRONG_PLACE_TYPE_GROUPS) {
    const c = escapeRe(canonical)
    out = out.replace(new RegExp(c + "\\s*", "g"), "").replace(new RegExp("ال" + c + "\\s*", "g"), "")
  }
  return out.replace(/\s+/g, " ").trim()
}
function projectNameToMatchSlug(name: string): string {
  const t = name.trim().toLowerCase()
  const withLookalikes = normalizeArabicLookalikes(t)
  const withAliases = normalizePlaceTypeAliases(withLookalikes)
  const afterTaMarbuta = normalizeTaMarbuta(withAliases)
  const strip = stripPlaceTypes(afterTaMarbuta)
  const toStrip = strip.length > 0 ? strip : afterTaMarbuta
  return toSlugFromStrip(toStrip)
}
export function projectSlugForCreate(name: string): string {
  const s = projectNameToMatchSlug(name)
  if (s) return s
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "project"
}
