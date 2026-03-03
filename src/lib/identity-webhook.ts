import { identifyContactByPhone } from "@/lib/identity-by-phone"
import { logWebhookEvent } from "@/lib/n8n-auth"

type AuthContext = { keyId: string | null }

/**
 * منطق ويب هوك الهوية — يُستدعى inline من resident أو من route الـ identity.
 */
export async function runIdentityLogic(
  input: string,
  authContext: AuthContext,
  ipAddress: string,
  requestBody?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const responseBody = await identifyContactByPhone(input)
  await logWebhookEvent(
    authContext.keyId,
    "CONTACT_IDENTIFIED",
    "/api/webhooks/identity",
    "POST",
    200,
    requestBody ?? { phone: input },
    responseBody,
    responseBody.contact?.role === "UNREGISTERED" ? "Unregistered number" : undefined,
    ipAddress
  )
  return responseBody as Record<string, unknown>
}
