/**
 * n8n يوقف الـ workflow لو استلم status ≠ 2xx، فالبوت ما يوصلش لـ humanReadable.
 * لذلك كل استجابات الـ webhook ترجع دائماً 200 والنتيجة (success / error / humanReadable) في الـ body.
 */
export const WEBHOOK_ALWAYS_OK = 200 as const

/** دائماً 200 حتى لا يوقف n8n الـ workflow — النتيجة في الـ body. */
export function webhookHttpStatus(_status?: number): number {
  return WEBHOOK_ALWAYS_OK
}

// ─── Conversational Response Abstraction (ردود موحّدة للبوت) ─────────────────

export type BotFailOptions = {
  suggestions?: string[]
  details?: Record<string, unknown>
}

/**
 * رد فشل موحّد للبوت: humanReadable + كود للـ branching والـ logging.
 * استخدمه في الـ webhooks عشان البوت يعرف يرد ويقترح خطوة تالية.
 */
export function botFail(
  messageAr: string,
  code?: string,
  options?: BotFailOptions
): { success: false; error: string; humanReadable: { ar: string }; code?: string; suggestions?: string[]; details?: Record<string, unknown> } {
  return {
    success: false,
    error: code ?? "ERROR",
    humanReadable: { ar: messageAr },
    ...(code && { code }),
    ...(options?.suggestions?.length && { suggestions: options.suggestions }),
    ...(options?.details && Object.keys(options.details).length > 0 && { details: options.details })
  }
}

/**
 * رد نجاح موحّد: success: true + بيانات + رسالة اختيارية للبوت.
 */
export function botSuccess<T extends Record<string, unknown>>(
  data: T,
  messageAr?: string
): T & { success: true } & (typeof messageAr extends string ? { humanReadable: { ar: string } } : object) {
  if (messageAr) {
    return { ...data, success: true as const, humanReadable: { ar: messageAr } }
  }
  return { ...data, success: true as const }
}
