/**
 * لأي خطأ عمل (400، 403، 404) نرجّع HTTP 200 مع الـ body عشان الورك فلو يوصّل الرد للبوت/المستخدم
 * ولا يتوقف بدون رد — البوت يقرأ success: false و humanReadable ويطلب التصحيح.
 */
export function webhookHttpStatus(status: number): number {
  if (status >= 400 && status < 500) return 200
  return status
}
