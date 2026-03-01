/** أقل عدد أرقام مقبول (مع كود الدولة) — مثلاً مصر +20 و 10 أرقام = 12 */
export const MIN_PHONE_DIGITS = 10
/** أقصى عدد أرقام (مع كود الدولة) */
export const MAX_PHONE_DIGITS = 15

export function normalizePhone(input?: string | null): string {
  if (!input) return ""
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return ""
  return hasPlus ? `+${digits}` : digits
}

/**
 * يتحقق أن الرقم صالح للتسجيل: بين 10 و 15 رقمًا (مع كود الدولة).
 * يقبل مثلاً مصر: +20 + 10 أرقام = 12 رقمًا.
 */
export function validatePhoneForRegistration(phone: string | null | undefined): { valid: boolean; error?: string } {
  if (phone == null || String(phone).trim() === "") {
    return { valid: false, error: "الرقم مطلوب" }
  }
  const digits = String(phone).replace(/\D/g, "")
  if (digits.length < MIN_PHONE_DIGITS) {
    return {
      valid: false,
      error: `رقم الهاتف يجب أن يكون ${MIN_PHONE_DIGITS} أرقام على الأقل (مع كود الدولة). المدخل: ${digits.length} رقمًا.`
    }
  }
  if (digits.length > MAX_PHONE_DIGITS) {
    return {
      valid: false,
      error: `رقم الهاتف يجب ألا يزيد عن ${MAX_PHONE_DIGITS} رقمًا. المدخل: ${digits.length} رقمًا.`
    }
  }
  return { valid: true }
}

export function buildPhoneVariants(input?: string | null): string[] {
  const variants = new Set<string>()
  if (!input) return []
  variants.add(input)

  const normalized = normalizePhone(input)
  if (normalized) {
    variants.add(normalized)
    const digitsOnly = normalized.replace(/^\+/, "")
    variants.add(digitsOnly)
    variants.add(`+${digitsOnly}`)
  }

  return Array.from(variants)
}
