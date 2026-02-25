import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"
import { notifyN8nEvent } from "@/lib/n8n-notify"

// Helper: get PM(s) for a project
async function getPMsForProject(projectId: string) {
  const assignments = await db.projectAssignment.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, name: true, whatsappPhone: true, role: true }
      }
    }
  })
  return assignments
    .filter(a => a.user.role === "PROJECT_MANAGER" && a.user.whatsappPhone)
    .map(a => ({ name: a.user.name, phone: a.user.whatsappPhone! }))
}

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json()

    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      )
    }

    if (auth.context.role !== "RESIDENT") {
      await logWebhookEvent(
        auth.context.keyId,
        "DELIVERY_ORDER_CREATED",
        "/api/webhooks/delivery-orders",
        "POST",
        403,
        body,
        { error: "Only residents can request delivery orders" },
        "Only residents can request delivery orders",
        ipAddress
      )

      return NextResponse.json(
        { error: "Only residents can request delivery orders" },
        { status: 403 }
      )
    }

    const {
      residentPhone,
      residentName,
      unitCode,
      description,
      orderText,
      projectId: bodyProjectId
    } = body ?? {}

    const normalizedDescription = (description || orderText || "").trim()
    const normalizedUnitCode = typeof unitCode === "string" ? unitCode.trim() : ""
    const normalizedPhone = typeof residentPhone === "string" ? residentPhone.trim() : ""
    const projectId = bodyProjectId || auth.context.projectId

    if (!normalizedPhone || !normalizedUnitCode || !normalizedDescription || !projectId) {
      await logWebhookEvent(
        auth.context.keyId,
        "DELIVERY_ORDER_CREATED",
        "/api/webhooks/delivery-orders",
        "POST",
        400,
        body,
        { error: "Missing required fields" },
        "Missing required fields: residentPhone, unitCode, description, projectId",
        ipAddress
      )

      return NextResponse.json(
        {
          error:
            "Missing required fields: residentPhone, unitCode, description, projectId"
        },
        { status: 400 }
      )
    }

    const unit = await db.operationalUnit.findFirst({
      where: {
        code: normalizedUnitCode,
        projectId
      },
      include: {
        project: true
      }
    })

    if (!unit) {
      await logWebhookEvent(
        auth.context.keyId,
        "DELIVERY_ORDER_CREATED",
        "/api/webhooks/delivery-orders",
        "POST",
        404,
        body,
        { error: "Unit not found" },
        `Unit with code ${normalizedUnitCode} not found in project`,
        ipAddress
      )

      return NextResponse.json(
        { error: "Unit not found for the given code and project" },
        { status: 404 }
      )
    }

    const phoneVariants = buildPhoneVariants(normalizedPhone)

    const resident = await db.resident.findFirst({
      where: {
        unitId: unit.id,
        OR: [
          { phone: { in: phoneVariants } },
          { whatsappPhone: { in: phoneVariants } }
        ]
      }
    })

    if (!resident) {
      await logWebhookEvent(
        auth.context.keyId,
        "DELIVERY_ORDER_CREATED",
        "/api/webhooks/delivery-orders",
        "POST",
        404,
        body,
        { error: "Resident not found" },
        "Resident not found for the given phone in this unit",
        ipAddress
      )

      return NextResponse.json(
        { error: "Resident not found for the given phone in this unit" },
        { status: 404 }
      )
    }

    const order = await db.deliveryOrder.create({
      data: {
        title: normalizedDescription.substring(0, 100),
        description: normalizedDescription,
        status: "NEW",
        residentId: resident.id,
        unitId: unit.id
      },
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        }
      }
    })

    await notifyN8nEvent("DELIVERY_ORDER_CREATED", {
      deliveryOrder: {
        id: order.id,
        title: order.title,
        description: order.description,
        status: order.status
      },
      resident: {
        id: order.resident.id,
        name: order.resident.name,
        phone: order.resident.phone,
        email: order.resident.email
      },
      unit: {
        id: order.unit.id,
        code: order.unit.code,
        name: order.unit.name,
        project: order.unit.project?.name ?? null
      },
      requestedBy: residentName || null
    })

    // Notify Project Manager(s) for this project
    const orderProjectId = order.unit.projectId
    if (orderProjectId) {
      const pms = await getPMsForProject(orderProjectId)
      if (pms.length > 0) {
        await notifyN8nEvent("PM_NEW_DELIVERY_ORDER", {
          pmPhones: pms,
          deliveryOrder: {
            id: order.id,
            title: order.title,
            description: order.description
          },
          resident: {
            name: order.resident.name,
            phone: order.resident.phone ?? null
          },
          unit: {
            code: order.unit.code,
            name: order.unit.name ?? null,
            projectName: order.unit.project?.name ?? null
          },
          humanReadable: {
            ar: `طلب استلام/توصيل جديد من الساكن ${order.resident.name} في الوحدة ${order.unit.code} — ${order.title}`
          }
        })
      }
    }

    const response = {
      success: true,
      orderId: order.id,
      message: "Delivery order created successfully",
      deliveryOrder: order
    }

    await logWebhookEvent(
      auth.context.keyId,
      "DELIVERY_ORDER_CREATED",
      "/api/webhooks/delivery-orders",
      "POST",
      201,
      body,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("Error creating delivery order:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "DELIVERY_ORDER_CREATED",
        "/api/webhooks/delivery-orders",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      { error: "Failed to create delivery order" },
      { status: 500 }
    )
  }
}
