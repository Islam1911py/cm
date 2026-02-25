import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ContactType = "PHONE" | "EMAIL"

const OWNER_ROLES = new Set(["ADMIN", "ACCOUNTANT"])

const prisma = db as any

type ContactInput = {
  id?: string
  type: ContactType
  value: string
  label?: string | null
  isPrimary?: boolean
  _delete?: boolean
}

const normalizeContacts = (contacts: ContactInput[]) => {
  const sanitized: ContactInput[] = contacts
    .filter((contact) =>
      (contact.type === "PHONE" || contact.type === "EMAIL") && contact.value?.trim()
    )
    .map((contact) => ({
      id: contact.id,
      type: contact.type,
      value: contact.value.trim(),
      label: contact.label?.trim() ?? null,
      isPrimary: Boolean(contact.isPrimary),
      _delete: Boolean(contact._delete),
    }))

  const byType: Record<ContactType, ContactInput[]> = {
    PHONE: [] as ContactInput[],
    EMAIL: [] as ContactInput[],
  }
  for (const contact of sanitized) {
    if (contact.type === "PHONE") {
      byType.PHONE.push(contact)
    } else {
      byType.EMAIL.push(contact)
    }
  }

  (Object.keys(byType) as ContactType[]).forEach((typeKey) => {
    const entries = byType[typeKey]
    if (!entries.length) return
    const primary = entries.find((c) => c.isPrimary && !c._delete)
    if (!primary) {
      const first = entries.find((c) => !c._delete)
      if (first) first.isPrimary = true
    } else {
      entries.forEach((c) => {
        if (c !== primary) c.isPrimary = false
      })
    }
  })

  return sanitized
}

// GET /api/operational-units/[id]/owner
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const ownerAssociation = await prisma.ownerAssociation.findUnique({
      where: { unitId: id },
      include: {
        contacts: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return NextResponse.json(ownerAssociation ?? null)
  } catch (error) {
    console.error("Error fetching owner association:", error)
    return NextResponse.json(
      { error: "Failed to fetch owner association", details: String(error) },
      { status: 500 }
    )
  }
}

// PUT /api/operational-units/[id]/owner
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !OWNER_ROLES.has(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const {
      name,
      email,
      phone,
      contacts: rawContacts = [],
    }: {
      name?: string | null
      email?: string | null
      phone?: string | null
      contacts?: ContactInput[]
    } = body
    const contacts = Array.isArray(rawContacts) ? rawContacts : []
    const sanitizedName =
      typeof name === "string" ? name.trim() : name ?? undefined
    const sanitizedEmail =
      typeof email === "string" ? email.trim() : email ?? undefined
    const sanitizedPhone =
      typeof phone === "string" ? phone.trim() : phone ?? undefined

    if (
      sanitizedName === undefined &&
      sanitizedEmail === undefined &&
      sanitizedPhone === undefined &&
      !contacts?.length
    ) {
      return NextResponse.json(
        { error: "Provide at least one field to update" },
        { status: 400 }
      )
    }

    const unitExists = await db.operationalUnit.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!unitExists) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    let ownerAssociation = await prisma.ownerAssociation.findUnique({
      where: { unitId: id },
      include: {
        contacts: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!ownerAssociation) {
      ownerAssociation = await prisma.ownerAssociation.create({
        data: {
          name: sanitizedName || "New Owner Association",
          email: sanitizedEmail ?? null,
          phone: sanitizedPhone ?? null,
          unit: { connect: { id } },
        },
        include: { contacts: true },
      })
    }

    const normalizedContacts = normalizeContacts(contacts)

    const updates = normalizedContacts.filter((c) => c.id && !c._delete)
    const creations = normalizedContacts.filter((c) => !c.id && !c._delete)
    const deletions = normalizedContacts
      .filter((c) => c.id && c._delete)
      .map((c) => c.id as string)

    await db.$transaction(async (tx) => {
      await tx.ownerAssociation.update({
        where: { id: ownerAssociation!.id },
        data: {
          ...(sanitizedName !== undefined && sanitizedName !== null && {
            name: sanitizedName,
          }),
          ...(sanitizedEmail !== undefined && { email: sanitizedEmail ?? null }),
          ...(sanitizedPhone !== undefined && { phone: sanitizedPhone ?? null }),
        },
      })

      for (const contactId of deletions) {
        await (tx as any).ownerAssociationContact.delete({
          where: { id: contactId },
        })
      }

      for (const contact of updates) {
        await (tx as any).ownerAssociationContact.update({
          where: { id: contact.id! },
          data: {
            type: contact.type,
            value: contact.value,
            label: contact.label ?? null,
            isPrimary: Boolean(contact.isPrimary),
          },
        })
      }

      for (const contact of creations) {
        await (tx as any).ownerAssociationContact.create({
          data: {
            ownerAssociationId: ownerAssociation!.id,
            type: contact.type,
            value: contact.value,
            label: contact.label ?? null,
            isPrimary: Boolean(contact.isPrimary),
          },
        })
      }

      // Re-sync primary phone/email for backwards compatibility
      const refreshedContacts = await (tx as any).ownerAssociationContact.findMany({
        where: { ownerAssociationId: ownerAssociation!.id },
        orderBy: { createdAt: "asc" },
      })

      const primaryPhone = refreshedContacts.find((c) => c.type === "PHONE" && c.isPrimary)
      const primaryEmail = refreshedContacts.find((c) => c.type === "EMAIL" && c.isPrimary)

      await tx.ownerAssociation.update({
        where: { id: ownerAssociation!.id },
        data: {
          phone:
            primaryPhone?.value ??
            (sanitizedPhone === undefined ? ownerAssociation!.phone : sanitizedPhone ?? null),
          email:
            primaryEmail?.value ??
            (sanitizedEmail === undefined ? ownerAssociation!.email : sanitizedEmail ?? null),
        },
      })
    })

    const refreshed = await prisma.ownerAssociation.findUnique({
      where: { id: ownerAssociation.id },
      include: {
        contacts: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return NextResponse.json(refreshed)
  } catch (error) {
    console.error("Error updating owner association:", error)
    return NextResponse.json(
      { error: "Failed to update owner association", details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE /api/operational-units/[id]/owner
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const ownerAssociation = await prisma.ownerAssociation.findUnique({
      where: { unitId: id },
      select: { id: true },
    })

    if (!ownerAssociation?.id) {
      return NextResponse.json({ success: true })
    }

    await prisma.ownerAssociation.delete({
      where: { id: ownerAssociation.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting owner association:", error)
    return NextResponse.json(
      { error: "Failed to delete owner association", details: String(error) },
      { status: 500 }
    )
  }
}
