/** عدد الأرقام المطلوب لأي رقم يُسجّل في التطبيق (ساكن، موظف، مستخدم، إلخ) */
export const REQUIRED_PHONE_DIGITS = 20

export function normalizePhone(input?: string | null): string {
  if (!input) return ""
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return ""
  return hasPlus ? `+${digits}` : digits
}

/**
 * يتحقق أن الرقم صالح للتسجيل: 20 رقمًا فقط (بعد إزالة أي رموز).
 * يُستخدم عند تسجيل ساكن، موظف، مستخدم، أو أي رقم في التطبيق.
 */
export function validatePhoneForRegistration(phone: string | null | undefined): { valid: boolean; error?: string } {
  if (phone == null || String(phone).trim() === "") {
    return { valid: false, error: "الرقم مطلوب" }
  }
  const digits = String(phone).replace(/\D/g, "")
  if (digits.length !== REQUIRED_PHONE_DIGITS) {
    return {
      valid: false,
      error: `رقم الهاتف يجب أن يكون ${REQUIRED_PHONE_DIGITS} رقمًا بالضبط (مع كود الدولة). المدخل: ${digits.length} رقمًا.`
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
