/**
 * يملأ حقل slug لجميع المشاريع من الاسم (slug مطلوب وفريد).
 * تشغيل مرة واحدة بعد إضافة العمود: npm run db:backfill-project-slug
 * السكربت مستقل (لا يعتمد على src/) ليعمل داخل الـ container.
 */
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

// نفس منطق projectSlugForCreate من src/lib/project-slug (مستقل عن src)
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
function projectNameToMatchSlug(name: string): string {
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
function projectSlugForCreate(name: string): string {
  const s = projectNameToMatchSlug(name)
  if (s) return s
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "project"
}

async function main() {
  const projects = await db.project.findMany({ select: { id: true, name: true, slug: true } })
  let updated = 0
  for (const p of projects) {
    const slug = projectSlugForCreate(p.name)
    if (slug !== p.slug) {
      await db.project.update({ where: { id: p.id }, data: { slug } })
      updated++
      console.log(`Updated ${p.name} → slug: ${slug}`)
    }
  }
  console.log(`Done. Updated ${updated} of ${projects.length} projects.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
