interface N8nEventPayload {
  eventType:
    | "TICKET_CREATED"
    | "TICKET_UPDATED"
    | "TICKET_RESOLVED"
    | "DELIVERY_ORDER_CREATED"
    | "PM_NEW_TICKET"
    | "PM_NEW_DELIVERY_ORDER"
  payload: Record<string, unknown>
}

const notificationUrl = process.env.N8N_NOTIFICATION_WEBHOOK_URL

async function postToN8n(body: N8nEventPayload) {
  if (!notificationUrl) {
    return
  }

  try {
    await fetch(notificationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })
  } catch (error) {
    console.error("Failed to notify n8n:", error)
  }
}

export async function notifyN8nEvent(
  eventType: N8nEventPayload["eventType"],
  payload: Record<string, unknown>
) {
  await postToN8n({ eventType, payload })
}
