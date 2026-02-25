export function normalizePhone(input?: string | null): string {
  if (!input) return ""
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return ""
  return hasPlus ? `+${digits}` : digits
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
