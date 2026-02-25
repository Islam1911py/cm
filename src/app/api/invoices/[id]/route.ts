import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const prisma = db as any

const normalizeInvoice = (invoice: any) => {
  if (!invoice) return null

  const unitExpenses = (invoice.expenses ?? []).map((expense: any) => ({
    ...expense,
    date: expense.date ?? expense.createdAt ?? null,
    createdAt: expense.createdAt ?? null,
    sourceType: expense.sourceType ?? "UNIT_EXPENSE"
  }))

  const operationalExpenses = (invoice.operationalExpenses ?? []).map((expense: any) => ({
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
}

// GET /api/invoices/[id] - Retrieve single invoice with related data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
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
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    return NextResponse.json(normalizeInvoice(invoice))
  } catch (error) {
    console.error("Error fetching invoice:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoice", details: String(error) },
      { status: 500 }
    )
  }
}

// PATCH /api/invoices/[id] - Update invoice (mark as paid, etc)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, amount } = body

    // Check if invoice exists
    const existingInvoice = await db.invoice.findUnique({
      where: { id }
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (action === "mark-paid" || action === "pay") {
      // For backward compatibility, treat mark-paid as full payment
      const paymentAmount = action === "mark-paid"
        ? existingInvoice.remainingBalance
        : amount

      if (!paymentAmount || paymentAmount <= 0) {
        return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 })
      }

      if (paymentAmount > existingInvoice.remainingBalance) {
        return NextResponse.json({ error: "Payment exceeds remaining balance" }, { status: 400 })
      }

      const newRemainingBalance = existingInvoice.remainingBalance - paymentAmount
      const newTotalPaid = (existingInvoice.totalPaid || 0) + paymentAmount
      const isPaidNow = newRemainingBalance <= 0

      await db.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id },
          data: {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            isPaid: isPaidNow
          }
        })

        await tx.payment.create({
          data: {
            invoiceId: id,
            amount: paymentAmount
          }
        })
      })

      const refreshed = await prisma.invoice.findUnique({
        where: { id },
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
        }
      })

      if (!refreshed) {
        return NextResponse.json({ error: "Invoice not found after update" }, { status: 404 })
      }

      return NextResponse.json(normalizeInvoice(refreshed))
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: "Failed to update invoice", details: String(error) },
      { status: 500 }
    )
  }
}
