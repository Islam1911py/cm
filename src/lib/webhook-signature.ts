import crypto from "crypto"
import { NextRequest } from "next/server"

export interface WebhookPayload<T = any> {
  body: T
  rawBody: string
}

export async function readSignedJson<T = any>(
  req: NextRequest,
  secret?: string | null
): Promise<WebhookPayload<T>> {
  const rawBody = await req.text()
  if (secret) {
    const signature = req.headers.get("x-signature") || ""
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")

    if (!signature || signature !== expected) {
      throw new Error("INVALID_SIGNATURE")
    }
  }

  const body = rawBody ? (JSON.parse(rawBody) as T) : ({} as T)
  return { body, rawBody }
}
