import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const prisma = db as any

// GET /api/invoices - List all invoices with their expenses
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      console.log("No session found")
      return NextResponse.json({ error: "Unauthorized: No session" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      console.log("User role:", session.user.role)
      return NextResponse.json({ error: "Unauthorized: Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const unitId = searchParams.get("unitId")
    const isPaidParam = searchParams.get("isPaid")

    // Build where clause
    const where: any = {}
    if (unitId) {
      where.unitId = unitId
    }
    if (isPaidParam !== null) {
      where.isPaid = isPaidParam === "true"
    }

    // Get all invoices with their associated data
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        unit: {
          include: {
            project: true
          }
        },
        ownerAssociation: {
          include: {
            contacts: {
              orderBy: { createdAt: "asc" }
            }
          }
        },
        expenses: {
          select: {
            id: true,
            description: true,
            amount: true,
            sourceType: true,
            date: true,
            createdAt: true
          }
        },
        operationalExpenses: {
          select: {
            id: true,
            description: true,
            amount: true,
            sourceType: true,
            recordedAt: true,
            createdAt: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { issuedAt: "desc" }
    })

    const normalized = invoices.map((invoice) => {
      const unitExpenses = (invoice.expenses ?? []).map((expense) => ({
        ...expense,
        date: expense.date ?? expense.createdAt ?? null,
        createdAt: expense.createdAt ?? null,
        sourceType: expense.sourceType ?? "UNIT_EXPENSE"
      }))

      const operationalExpenses = (invoice.operationalExpenses ?? []).map((expense) => ({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        sourceType: expense.sourceType,
        date: expense.recordedAt ?? expense.createdAt ?? null,
        createdAt: expense.createdAt ?? null
      }))

      const mergedExpenses = [...unitExpenses, ...operationalExpenses].sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0
        const bTime = b.date ? new Date(b.date).getTime() : 0
        return bTime - aTime
      })

      const {
        operationalExpenses: _op,
        expenses: _unitExpenses,
        payments: _payments,
        ownerAssociation: rawOwnerAssociation,
        ...rest
      } = invoice

      const ownerContacts = rawOwnerAssociation?.contacts ?? []
      const primaryPhone = ownerContacts.find(
        (contact: any) => contact.type === "PHONE" && contact.isPrimary
      )?.value
      const primaryEmail = ownerContacts.find(
        (contact: any) => contact.type === "EMAIL" && contact.isPrimary
      )?.value

      const ownerAssociation = rawOwnerAssociation
        ? {
            ...rawOwnerAssociation,
            phone: primaryPhone ?? rawOwnerAssociation.phone ?? null,
            email: primaryEmail ?? rawOwnerAssociation.email ?? null,
            contacts: ownerContacts
          }
        : null

      return {
        ...rest,
        expenses: mergedExpenses,
        payments: invoice.payments ?? [],
        ownerAssociation
      }
    })

    return NextResponse.json(normalized)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json({ error: "Failed to fetch invoices", details: String(error) }, { status: 500 })
  }
}
