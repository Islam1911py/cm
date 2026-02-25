import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export interface N8nAuthContext {
  apiKey: string
  keyId: string
  role: "RESIDENT" | "ACCOUNTANT" | "ADMIN" | "PROJECT_MANAGER"
  projectId?: string
}

/**
 * Verify N8n API key and rate limiting
 */
export async function verifyN8nApiKey(
  req: NextRequest
): Promise<{ valid: boolean; context?: N8nAuthContext; error?: string }> {
  const apiKey = req.headers.get("x-api-key")

  if (!apiKey) {
    return { valid: false, error: "Missing API key" }
  }

  try {
    const key = await db.n8nApiKey.findUnique({
      where: { key: apiKey }
    })

    if (!key || !key.isActive) {
      return { valid: false, error: "Invalid or inactive API key" }
    }

    // Check rate limiting
    const now = new Date()
    const minuteAgo = new Date(now.getTime() - 60000)

    // Reset counter if last reset was more than a minute ago
    if (key.lastResetAt < minuteAgo) {
      await db.n8nApiKey.update({
        where: { id: key.id },
        data: {
          requestCount: 1,
          lastResetAt: now
        }
      })
    } else {
      // Check if exceeded rate limit
      if (key.requestCount >= key.rateLimit) {
        return {
          valid: false,
          error: `Rate limit exceeded (${key.rateLimit} requests per minute)`
        }
      }

      // Increment request count
      await db.n8nApiKey.update({
        where: { id: key.id },
        data: { requestCount: key.requestCount + 1 }
      })
    }

    return {
      valid: true,
      context: {
        apiKey,
        keyId: key.id,
        role: key.role as any,
        projectId: key.projectId || undefined
      }
    }
  } catch (error) {
    console.error("Error verifying API key:", error)
    return { valid: false, error: "Failed to verify API key" }
  }
}

/**
 * Log webhook event
 */
export async function logWebhookEvent(
  keyId: string,
  eventType: string,
  endpoint: string,
  method: string,
  statusCode: number,
  requestBody?: any,
  responseBody?: any,
  errorMessage?: string,
  ipAddress?: string
) {
  try {
    await db.n8nWebhookLog.create({
      data: {
        apiKeyId: keyId,
        eventType: eventType as any,
        endpoint,
        method,
        statusCode,
        requestBody: requestBody ? JSON.stringify(requestBody) : null,
        responseBody: responseBody ? JSON.stringify(responseBody) : null,
        errorMessage,
        ipAddress
      }
    })
  } catch (error) {
    console.error("Error logging webhook event:", error)
  }
}
